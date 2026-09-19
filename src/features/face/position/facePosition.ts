import type {
    DetectedFace,
    FaceDetectionState,
    FacePositionResult,
    FacePositionStatus,
} from '../types';

// ─── Configuration ───────────────────────────────────────────────────────────

export const FACE_POSITION_CONFIG = {
    /**
     * Acceptable centre region in normalised frame coordinates (0..1).
     * The face centre must fall inside this box to be considered "centered".
     *
     * Expressed as distance from the frame centre along each axis.
     * 0.20 = centre must be within the middle 40% of the frame width.
     * 0.25 = centre must be within the middle 50% of the frame height.
     *
     * These are intentionally generous — tighter values belong to quality,
     * not position.
     */
    CENTRE_TOLERANCE_X: 0.20,
    CENTRE_TOLERANCE_Y: 0.25,
} as const;

// ─── Evaluator ───────────────────────────────────────────────────────────────

/**
 * Evaluate whether the detected face is centred in the frame.
 *
 * All calculations are in ML Kit frame-space coordinates.
 * Does NOT use React Native screen dimensions.
 *
 * Returns null when the detection state does not contain exactly one face.
 */
export function evaluateFacePosition(
    detectionState: FaceDetectionState,
): FacePositionResult | null {
    if (detectionState.status !== 'one-face') return null;

    const face: DetectedFace = detectionState.faces[0];
    const { bounds, frameWidth, frameHeight } = face;

    if (!frameWidth || frameWidth <= 0 || !frameHeight || frameHeight <= 0) {
        return null;
    }

    // Face centre in frame-space pixels.
    const faceCentreX = bounds.x + bounds.width / 2;
    const faceCentreY = bounds.y + bounds.height / 2;

    // Normalise to 0..1 relative to frame dimensions.
    const normalisedCentreX = faceCentreX / frameWidth;
    const normalisedCentreY = faceCentreY / frameHeight;

    const status = computePositionStatus(normalisedCentreX, normalisedCentreY);

    return {
        status,
        normalisedCentreX,
        normalisedCentreY,
    };
}

function computePositionStatus(
    normX: number,
    normY: number,
): FacePositionStatus {
    const { CENTRE_TOLERANCE_X, CENTRE_TOLERANCE_Y } = FACE_POSITION_CONFIG;

    // Frame centre in normalised coords is always (0.5, 0.5).
    const dx = normX - 0.5;
    const dy = normY - 0.5;

    // Horizontal axis — check first so left/right guidance takes priority
    // over up/down when both are off (simpler for the user to follow).
    if (dx < -CENTRE_TOLERANCE_X) return 'too-far-left';
    if (dx > CENTRE_TOLERANCE_X) return 'too-far-right';

    // Vertical axis.
    if (dy < -CENTRE_TOLERANCE_Y) return 'too-high';
    if (dy > CENTRE_TOLERANCE_Y) return 'too-low';

    return 'centered';
}