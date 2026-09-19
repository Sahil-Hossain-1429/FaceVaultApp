import { useCallback, useRef, useState } from 'react';
import type { CameraPhotoOutput } from 'react-native-vision-camera';
import { usePhotoOutput } from 'react-native-vision-camera';
import { useImageFaceDetector } from 'react-native-vision-camera-face-detector';
import { alignAllFrames } from '../alignment/faceAlignment';
import { evaluateFacePosition } from '../position/facePosition';
import { evaluateFaceQuality } from '../quality/faceQuality';
import type {
    CapturedFaceFrame,
    DetectedFace,
    DetectedFaceLandmarks,
    FaceCaptureStatus,
    FaceDetectionState,
    FaceEnrollmentState,
    FacePoint,
} from '../types';
import { INITIAL_ENROLLMENT_STATE } from '../types';

// ─── Configuration ───────────────────────────────────────────────────────────

const CAPTURE_CONFIG = {
    /**
     * Consecutive good detections required before a capture fires.
     * At ~200ms throttle this is approximately 1 second of stability.
     */
    STABLE_FRAME_TARGET: 5,

    /**
     * Number of accepted captured frames before enrollment is complete.
     */
    TARGET_FRAME_COUNT: 5,

    /**
     * Minimum milliseconds between capture attempts.
     * Prevents hammering the camera while the pipeline is busy.
     */
    MIN_CAPTURE_INTERVAL_MS: 1500,
} as const;

// ─── Landmark mapper ──────────────────────────────────────────────────────────
// Maps the face-detector's Face (from useImageFaceDetector) into our
// domain DetectedFace. Separate from the live-preview path intentionally —
// the image detector runs on a captured file, not a live frame.

function mapPoint(
    p: { x: number; y: number } | undefined,
): FacePoint | undefined {
    return p ? { x: p.x, y: p.y } : undefined;
}

function mapImageFace(
    face: import('react-native-vision-camera-face-detector').Face,
): DetectedFace {
    let landmarks: DetectedFaceLandmarks | null = null;
    if (face.landmarks) {
        const l = face.landmarks;
        landmarks = {
            LEFT_EYE: mapPoint(l.LEFT_EYE),
            RIGHT_EYE: mapPoint(l.RIGHT_EYE),
            NOSE_BASE: mapPoint(l.NOSE_BASE),
            MOUTH_LEFT: mapPoint(l.MOUTH_LEFT),
            MOUTH_RIGHT: mapPoint(l.MOUTH_RIGHT),
            MOUTH_BOTTOM: mapPoint(l.MOUTH_BOTTOM),
            LEFT_EAR: mapPoint(l.LEFT_EAR),
            RIGHT_EAR: mapPoint(l.RIGHT_EAR),
            LEFT_CHEEK: mapPoint(l.LEFT_CHEEK),
            RIGHT_CHEEK: mapPoint(l.RIGHT_CHEEK),
        };
    }
    return {
        trackingId: face.trackingId ?? null,
        bounds: {
            x: face.bounds.x,
            y: face.bounds.y,
            width: face.bounds.width,
            height: face.bounds.height,
        },
        rollAngle: face.rollAngle,
        pitchAngle: face.pitchAngle,
        yawAngle: face.yawAngle,
        landmarks,
        frameWidth: face.frameWidth,
        frameHeight: face.frameHeight,
    };
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseFaceCaptureReturn {
    enrollmentState: FaceEnrollmentState;
    /**
     * Attach this to <Camera outputs={[photoOutput]} />.
     * Typed as CameraPhotoOutput so the Camera component accepts it.
     */
    photoOutput: CameraPhotoOutput;
    /** Call on every detection state update from useFaceDetection */
    onDetectionState: (state: FaceDetectionState) => void;
    /** Reset the enrollment session back to idle */
    reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFaceCapture(): UseFaceCaptureReturn {
    // usePhotoOutput returns CameraPhotoOutput — attach it via outputs={[photoOutput]}
    const photoOutput = usePhotoOutput();

    // useImageFaceDetector — runs ML Kit on a captured photo file URI.
    // runLandmarks: true so we get eye positions for alignment.
    const imageDetector = useImageFaceDetector({ runLandmarks: true });

    const [enrollmentState, setEnrollmentState] = useState<FaceEnrollmentState>(
        INITIAL_ENROLLMENT_STATE,
    );

    // Refs — values needed inside async callbacks without triggering re-renders.
    const stableCountRef = useRef(0);
    const capturedFramesRef = useRef<CapturedFaceFrame[]>([]);
    const captureStatusRef = useRef<FaceCaptureStatus>('idle');
    const lastCaptureTimeRef = useRef(0);
    const isCapturingRef = useRef(false);

    const updateState = useCallback((partial: Partial<FaceEnrollmentState>) => {
        setEnrollmentState(prev => ({ ...prev, ...partial }));
    }, []);

    const reset = useCallback(() => {
        stableCountRef.current = 0;
        capturedFramesRef.current = [];
        captureStatusRef.current = 'idle';
        lastCaptureTimeRef.current = 0;
        isCapturingRef.current = false;
        setEnrollmentState(INITIAL_ENROLLMENT_STATE);
    }, []);

    // ── Photo capture ─────────────────────────────────────────────────────────
    // Defined before onDetectionState so the ref closure sees the stable version.
    const captureFrame = useCallback(async () => {
        try {
            // capturePhotoToFile writes directly to a temp file.
            // Returns { filePath: string } — a filesystem path, not a file:// URI.
            const photoFile = await photoOutput.capturePhotoToFile({}, {});

            // expo-image-manipulator and useImageFaceDetector both accept
            // filesystem paths without a file:// prefix.
            const filePath = photoFile.filePath;

            // Run ML Kit face detection on the saved photo.
            // This gives us landmark coordinates in photo-space — NOT preview-space.
            // We pass { uri: filePath } as InputImage.
            const detectedFaces = imageDetector.detectFaces({ uri: filePath });

            if (detectedFaces.length !== 1) {
                console.warn(
                    `[Capture] Expected 1 face in captured photo, got ${detectedFaces.length}. Discarding.`,
                );
                return;
            }

            const face = mapImageFace(detectedFaces[0]);

            // Reject the frame if eye landmarks are absent — alignment requires them.
            if (!face.landmarks?.LEFT_EYE || !face.landmarks?.RIGHT_EYE) {
                console.warn('[Capture] Captured photo missing eye landmarks. Discarding.');
                return;
            }

            // Use frameWidth/frameHeight from the ML Kit result on the photo.
            // These reflect the actual photo pixel dimensions.
            const frame: CapturedFaceFrame = {
                id: `frame-${Date.now()}`,
                uri: filePath,
                width: face.frameWidth,
                height: face.frameHeight,
                face,
            };

            capturedFramesRef.current = [...capturedFramesRef.current, frame];
            const capturedCount = capturedFramesRef.current.length;
            const targetReached = capturedCount >= CAPTURE_CONFIG.TARGET_FRAME_COUNT;

            updateState({
                capturedFrames: [...capturedFramesRef.current],
                captureStatus: targetReached ? 'capturing' : 'evaluating',
            });

            // ── Run alignment when we have enough frames ───────────────────────
            if (targetReached) {
                captureStatusRef.current = 'capturing';
                updateState({ captureStatus: 'capturing' });

                try {
                    const alignedFaces = await alignAllFrames(capturedFramesRef.current);
                    captureStatusRef.current = 'complete';
                    updateState({
                        captureStatus: 'complete',
                        alignedFaces,
                    });
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Alignment failed';
                    console.error('[Capture] Alignment error:', e);
                    captureStatusRef.current = 'error';
                    updateState({ captureStatus: 'error', error: msg });
                }
            }
        } catch (e) {
            // A single failed capture is logged and silently dropped.
            // The stability loop will retry on the next stable window.
            console.warn(
                '[Capture] Frame discarded:',
                e instanceof Error ? e.message : e,
            );
        } finally {
            isCapturingRef.current = false;
        }
    }, [photoOutput, imageDetector, updateState]);

    // ── Main detection handler ────────────────────────────────────────────────
    const onDetectionState = useCallback(
        (detectionState: FaceDetectionState) => {
            // Ignore updates once finished or while a capture is in flight.
            if (
                captureStatusRef.current === 'complete' ||
                captureStatusRef.current === 'error' ||
                isCapturingRef.current
            ) return;

            // ── Evaluate quality and position ─────────────────────────────────
            const qualityResult = evaluateFaceQuality(detectionState);
            const positionResult = evaluateFacePosition(detectionState);

            const qualityGood = qualityResult?.status === 'good';
            const positionGood = positionResult?.status === 'centered';
            const frameGood = qualityGood && positionGood;

            // ── Stability counter ─────────────────────────────────────────────
            if (frameGood) {
                stableCountRef.current += 1;
            } else {
                stableCountRef.current = 0;
            }

            const stableCount = stableCountRef.current;
            const isStable = stableCount >= CAPTURE_CONFIG.STABLE_FRAME_TARGET;
            const capturedCount = capturedFramesRef.current.length;
            const targetReached = capturedCount >= CAPTURE_CONFIG.TARGET_FRAME_COUNT;

            // ── Derive status ─────────────────────────────────────────────────
            let captureStatus: FaceCaptureStatus;
            if (targetReached) {
                captureStatus = 'complete';
            } else if (isStable) {
                captureStatus = 'capturing';
            } else if (frameGood) {
                captureStatus = 'stabilising';
            } else {
                captureStatus = 'evaluating';
            }

            captureStatusRef.current = captureStatus;

            updateState({
                captureStatus,
                qualityResult,
                positionResult,
                stableFrameCount: stableCount,
                stableFrameTarget: CAPTURE_CONFIG.STABLE_FRAME_TARGET,
                capturedFrames: [...capturedFramesRef.current],
                targetFrameCount: CAPTURE_CONFIG.TARGET_FRAME_COUNT,
            });

            // ── Fire capture when stable and not yet done ─────────────────────
            if (isStable && !targetReached && !isCapturingRef.current) {
                const now = Date.now();
                if (now - lastCaptureTimeRef.current < CAPTURE_CONFIG.MIN_CAPTURE_INTERVAL_MS) {
                    return;
                }
                lastCaptureTimeRef.current = now;
                stableCountRef.current = 0; // reset so we don't fire again immediately
                isCapturingRef.current = true;
                captureFrame();
            }
        },
        [updateState, captureFrame],
    );

    return {
        enrollmentState,
        photoOutput,
        onDetectionState,
        reset,
    };
}