import type {
    DetectedFace,
    FaceDetectionState,
    FaceQualityResult,
    FaceQualityStatus,
} from '../types';

// ─── Configuration ───────────────────────────────────────────────────────────
// All thresholds are documented against their measurement units.

export const FACE_QUALITY_CONFIG = {
    /**
     * Minimum acceptable face width as a fraction of the ML Kit frame width.
     * Below this the face is too far from the camera.
     * 0.20 = face must occupy at least 20% of the frame width.
     */
    MIN_FACE_SIZE_RATIO: 0.20,

    /**
     * Maximum acceptable face width as a fraction of the ML Kit frame width.
     * Above this the face is too close to the camera.
     * 0.75 = face must not exceed 75% of the frame width.
     */
    MAX_FACE_SIZE_RATIO: 0.75,

    /**
     * Maximum absolute yaw angle in degrees before the pose is rejected.
     * Yaw = left/right head turn. ML Kit returns values roughly in [-90, 90].
     * 25° allows mild turns while ensuring the face is mostly frontal.
     */
    MAX_YAW_DEG: 25,

    /**
     * Maximum absolute pitch angle in degrees before the pose is rejected.
     * Pitch = up/down head tilt. Same range as yaw.
     * 20° allows mild nods.
     */
    MAX_PITCH_DEG: 20,

    /**
     * Maximum absolute roll angle in degrees before the pose is rejected.
     * Roll = in-plane head rotation (tilting ear toward shoulder).
     * 20° allows slight tilt without distorting eye geometry.
     */
    MAX_ROLL_DEG: 20,
} as const;

// ─── Evaluator ───────────────────────────────────────────────────────────────

/**
 * Evaluate the quality of a single detected face.
 *
 * Uses ML Kit frame-space coordinates exclusively.
 * Does NOT use React Native screen dimensions.
 *
 * Returns null when the detection state does not contain exactly one face.
 */
export function evaluateFaceQuality(
    detectionState: FaceDetectionState,
): FaceQualityResult | null {
    if (detectionState.status !== 'one-face') return null;

    const face: DetectedFace = detectionState.faces[0];
    const { bounds, frameWidth, yawAngle, pitchAngle, rollAngle } = face;

    // Guard: frameWidth must be positive (defensive — ML Kit always provides it).
    if (!frameWidth || frameWidth <= 0) return null;

    const relativeFaceWidth = bounds.width / frameWidth;

    // Euler angles are always non-null in v2.1.0 (typed as number, not number|null).
    // Cast from our domain type (number | null) safely.
    const yaw = yawAngle ?? 0;
    const pitch = pitchAngle ?? 0;
    const roll = rollAngle ?? 0;

    const status = computeQualityStatus(relativeFaceWidth, yaw, pitch, roll);

    return {
        status,
        relativeFaceWidth,
        yawAngle: yaw,
        pitchAngle: pitch,
        rollAngle: roll,
    };
}

function computeQualityStatus(
    relativeFaceWidth: number,
    yaw: number,
    pitch: number,
    roll: number,
): FaceQualityStatus {
    const { MIN_FACE_SIZE_RATIO, MAX_FACE_SIZE_RATIO, MAX_YAW_DEG, MAX_PITCH_DEG, MAX_ROLL_DEG } =
        FACE_QUALITY_CONFIG;

    // Size checks take priority — guide the user to the right distance first.
    if (relativeFaceWidth < MIN_FACE_SIZE_RATIO) return 'face-too-small';
    if (relativeFaceWidth > MAX_FACE_SIZE_RATIO) return 'face-too-large';

    // Pose check — all three axes must be within limits.
    if (
        Math.abs(yaw) > MAX_YAW_DEG ||
        Math.abs(pitch) > MAX_PITCH_DEG ||
        Math.abs(roll) > MAX_ROLL_DEG
    ) {
        return 'bad-pose';
    }

    return 'good';
}