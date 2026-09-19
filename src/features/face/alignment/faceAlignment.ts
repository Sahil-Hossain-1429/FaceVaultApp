import * as ImageManipulator from 'expo-image-manipulator';
import type { AlignedFace, CapturedFaceFrame, FacePoint } from '../types';
import { ALIGNMENT_CONFIG } from './alignmentConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EyeGeometry {
    /** Midpoint between the two eyes in photo-space pixels */
    midX: number;
    midY: number;
    /** Distance between eye centres in photo-space pixels */
    distance: number;
    /**
     * Angle of the eye-to-eye line relative to horizontal, in degrees.
     * Positive = right eye is higher than left eye.
     * Used to rotate the image so the eyes become level.
     */
    angleDeg: number;
}

interface CropRegion {
    originX: number;
    originY: number;
    width: number;
    height: number;
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

/**
 * Compute eye geometry from two landmark points in photo-space coordinates.
 *
 * ML Kit landmark coordinates on a captured photo are in the photo's own
 * pixel space (origin top-left, x right, y down), so standard 2D geometry
 * applies directly.
 */
function computeEyeGeometry(leftEye: FacePoint, rightEye: FacePoint): EyeGeometry {
    const midX = (leftEye.x + rightEye.x) / 2;
    const midY = (leftEye.y + rightEye.y) / 2;
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // atan2 gives the angle of the vector from leftEye → rightEye.
    // We negate it because image y increases downward, so a positive
    // dy means the right eye is lower — we want to rotate upward (negative).
    const angleDeg = -(Math.atan2(dy, dx) * 180) / Math.PI;

    return { midX, midY, distance, angleDeg };
}

/**
 * Compute a square crop region centred on the eye midpoint.
 *
 * Side length = CROP_SCALE_FACTOR × inter-eye distance.
 * Clamped to the image boundaries to avoid out-of-bounds crops.
 */
function computeCropRegion(
    geometry: EyeGeometry,
    photoWidth: number,
    photoHeight: number,
): CropRegion {
    const side = geometry.distance * ALIGNMENT_CONFIG.CROP_SCALE_FACTOR;

    // Centre the crop on the eye midpoint.
    // Shift the vertical centre slightly upward (by 15% of side) so the
    // forehead is included — the midpoint sits roughly at the eye level
    // which is about 40% from the top of a standard face crop.
    const centreX = geometry.midX;
    const centreY = geometry.midY - side * 0.05; // small upward bias

    let originX = centreX - side / 2;
    let originY = centreY - side / 2;

    // Clamp to image bounds.
    originX = Math.max(0, Math.min(originX, photoWidth - side));
    originY = Math.max(0, Math.min(originY, photoHeight - side));

    // If the crop would exceed the image (face too close to edge), shrink it.
    const actualWidth = Math.min(side, photoWidth - originX);
    const actualHeight = Math.min(side, photoHeight - originY);
    const actualSide = Math.min(actualWidth, actualHeight);

    return {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: Math.round(actualSide),
        height: Math.round(actualSide),
    };
}

// ─── Main Alignment Function ─────────────────────────────────────────────────

/**
 * Align a single captured face frame.
 *
 * Pipeline:
 *   1. Verify landmarks are available on the post-capture ML Kit detection.
 *   2. Compute eye geometry (midpoint, distance, rotation angle).
 *   3. Rotate the photo so the eyes are level.
 *   4. Crop a square region centred on the eye midpoint.
 *   5. Resize the crop to OUTPUT_SIZE × OUTPUT_SIZE.
 *   6. Save as JPEG and return an AlignedFace.
 *
 * Coordinate system notes:
 * ─────────────────────────────────────────────────────────────────────────────
 * The face-detector's useImageFaceDetector runs ML Kit on the captured
 * photo file. ML Kit returns landmark coordinates in the photo's own
 * pixel space (origin top-left, x→right, y→down) at the photo's native
 * resolution. This is the same space expo-image-manipulator operates in,
 * so no coordinate transformation is needed between landmark detection
 * and the crop/rotate operations.
 *
 * Front-camera mirroring:
 * The front camera preview is visually mirrored for the user but the
 * captured JPEG saved by VisionCamera v5 is NOT mirrored — it is saved
 * in the natural camera orientation. ML Kit running on that saved file
 * therefore sees the correct (non-mirrored) coordinates. The subject's
 * LEFT_EYE landmark will be on the left side of the saved photo.
 * No horizontal flip is required.
 *
 * Rotation:
 * We rotate the entire photo before cropping. After rotation the eye
 * line is horizontal, which makes the subsequent square crop geometry
 * straightforward. expo-image-manipulator's rotate action rotates
 * counter-clockwise by the given degrees (positive = CCW).
 * We pass -angleDeg (i.e. CW by angleDeg) to level the eyes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function alignFace(frame: CapturedFaceFrame): Promise<AlignedFace> {
    const { face, uri, width: photoWidth, height: photoHeight, id } = frame;

    // ── 1. Verify landmarks ──────────────────────────────────────────────────
    const landmarks = face.landmarks;
    if (!landmarks?.LEFT_EYE || !landmarks?.RIGHT_EYE) {
        throw new Error(
            `[Alignment] Frame ${id}: ML Kit did not return eye landmarks on the captured photo. ` +
            'Ensure runLandmarks: true and that the face is clearly visible in the photo.',
        );
    }

    const leftEye = landmarks.LEFT_EYE;   // subject's left eye
    const rightEye = landmarks.RIGHT_EYE;  // subject's right eye

    // ── 2. Compute eye geometry ──────────────────────────────────────────────
    const geometry = computeEyeGeometry(leftEye, rightEye);

    if (geometry.distance < 10) {
        // Eyes are implausibly close — landmark detection likely failed.
        throw new Error(
            `[Alignment] Frame ${id}: Inter-eye distance is ${geometry.distance.toFixed(1)}px — ` +
            'landmarks may be unreliable. Skipping frame.',
        );
    }

    // ── 3. Rotate so eyes are level ──────────────────────────────────────────
    // expo-image-manipulator rotates CCW by degrees.
    // To level the eyes we rotate CW by angleDeg, i.e. pass -angleDeg.
    // We only rotate if the tilt is meaningful (> 0.5°) to avoid
    // unnecessary resampling on already-level faces.
    const rotationDeg = Math.abs(geometry.angleDeg) > 0.5 ? -geometry.angleDeg : 0;

    // After rotation the photo dimensions may change (expo-image-manipulator
    // expands the canvas to fit the rotated content). We need the post-rotation
    // dimensions to correctly clamp the crop region.
    // Strategy: rotate first, then re-derive the crop centre.
    //
    // The eye midpoint after rotation (approximate, valid for small angles):
    // For small rotations the centre of the image stays fixed and the eye
    // midpoint rotates around it. For the crop we use the rotated coordinates.
    //
    // For simplicity and correctness we perform the rotation in a first
    // manipulator call, then compute the crop on the rotated image dimensions.

    const { OUTPUT_SIZE, JPEG_QUALITY } = ALIGNMENT_CONFIG;

    // Step A: rotate only (no crop yet) so we can get rotated dimensions.
    const actions: ImageManipulator.Action[] = [];
    if (rotationDeg !== 0) {
        actions.push({ rotate: rotationDeg });
    }

    // Step B: after rotation, compute where the eye midpoint landed.
    // For a rotation of θ around the image centre (cx, cy):
    //   x' = cx + (x-cx)·cos(θ) - (y-cy)·sin(θ)
    //   y' = cy + (x-cx)·sin(θ) + (y-cy)·cos(θ)
    // θ here is the rotation applied CCW in standard math coords.
    // In image coords (y down) a CCW rotation is a CW visual rotation.
    // expo-image-manipulator rotates CCW visually, so θ = rotationDeg in radians.
    const θ = (rotationDeg * Math.PI) / 180;
    const cx = photoWidth / 2;
    const cy = photoHeight / 2;

    function rotatePoint(p: FacePoint): FacePoint {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return {
            x: cx + dx * Math.cos(θ) - dy * Math.sin(θ),
            y: cy + dx * Math.sin(θ) + dy * Math.cos(θ),
        };
    }

    const rotatedLeftEye = rotationDeg !== 0 ? rotatePoint(leftEye) : leftEye;
    const rotatedRightEye = rotationDeg !== 0 ? rotatePoint(rightEye) : rightEye;
    const rotatedGeometry = computeEyeGeometry(rotatedLeftEye, rotatedRightEye);

    // After rotation the canvas may be larger. expo-image-manipulator
    // returns the new dimensions in the result — but to avoid two round-trips
    // we estimate: for a rotation of θ around the centre, the new bounding
    // box dimensions are:
    //   W' = |W·cos(θ)| + |H·sin(θ)|
    //   H' = |W·sin(θ)| + |H·cos(θ)|
    const absTheta = Math.abs(θ);
    const rotatedWidth = Math.round(
        Math.abs(photoWidth * Math.cos(absTheta)) +
        Math.abs(photoHeight * Math.sin(absTheta)),
    );
    const rotatedHeight = Math.round(
        Math.abs(photoWidth * Math.sin(absTheta)) +
        Math.abs(photoHeight * Math.cos(absTheta)),
    );

    // ── 4. Compute crop region on the rotated image ──────────────────────────
    const cropRegion = computeCropRegion(
        rotatedGeometry,
        rotatedWidth,
        rotatedHeight,
    );

    // ── 5. Apply all operations in one manipulator call ──────────────────────
    // Order: rotate → crop → resize.
    // All three in one call avoids saving an intermediate file.
    if (rotationDeg !== 0) {
        // Already pushed rotate above — now add crop and resize.
    }
    actions.push({
        crop: {
            originX: cropRegion.originX,
            originY: cropRegion.originY,
            width: cropRegion.width,
            height: cropRegion.height,
        },
    });
    actions.push({
        resize: {
            width: OUTPUT_SIZE,
            height: OUTPUT_SIZE,
        },
    });

    const result = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        {
            compress: JPEG_QUALITY / 100,
            format: ImageManipulator.SaveFormat.JPEG,
        },
    );

    return {
        id: `aligned-${id}`,
        uri: result.uri,
        width: result.width,
        height: result.height,
        sourceFrameId: id,
    };
}

/**
 * Align all captured frames.
 * Skips frames that fail alignment (logs the error) so one bad frame
 * does not abort the entire batch.
 */
export async function alignAllFrames(
    frames: CapturedFaceFrame[],
): Promise<AlignedFace[]> {
    const results: AlignedFace[] = [];
    for (const frame of frames) {
        try {
            const aligned = await alignFace(frame);
            results.push(aligned);
        } catch (e) {
            console.warn('[Alignment] Skipping frame due to error:', e);
        }
    }
    return results;
}