// ─── Phase 1: Face Detection Status ─────────────────────────────────────────
export type FaceDetectionStatus =
    | 'no-face'
    | 'one-face'
    | 'multiple-faces';

// ─── Phase 1: Bounding Box ───────────────────────────────────────────────────
// Raw coordinates in ML Kit frame-space (NOT screen coordinates).
export interface FaceBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ─── Phase 1: Landmark Point ─────────────────────────────────────────────────
export interface FacePoint {
    x: number;
    y: number;
}

// ─── Phase 1: Detected Face Landmarks ────────────────────────────────────────
// Mirrors the Landmarks shape from react-native-vision-camera-face-detector.
// All fields are optional — only present when runLandmarks: true.
export interface DetectedFaceLandmarks {
    LEFT_EYE?: FacePoint;
    RIGHT_EYE?: FacePoint;
    NOSE_BASE?: FacePoint;
    MOUTH_LEFT?: FacePoint;
    MOUTH_RIGHT?: FacePoint;
    MOUTH_BOTTOM?: FacePoint;
    LEFT_EAR?: FacePoint;
    RIGHT_EAR?: FacePoint;
    LEFT_CHEEK?: FacePoint;
    RIGHT_CHEEK?: FacePoint;
}

// ─── Phase 1: Detected Face ──────────────────────────────────────────────────
export interface DetectedFace {
    trackingId: number | null;
    bounds: FaceBoundingBox;
    rollAngle: number | null;
    pitchAngle: number | null;
    yawAngle: number | null;
    /** Populated when runLandmarks: true */
    landmarks: DetectedFaceLandmarks | null;
    /** ML Kit frame dimensions — the frame the detection ran on */
    frameWidth: number;
    frameHeight: number;
}

// ─── Phase 1: Face Detection State ───────────────────────────────────────────
export interface FaceDetectionState {
    status: FaceDetectionStatus;
    faces: DetectedFace[];
    isInitializing: boolean;
    error: FaceDetectionError | null;
}

// ─── Phase 1: Errors ─────────────────────────────────────────────────────────
export type FaceDetectionErrorCode =
    | 'PERMISSION_DENIED'
    | 'PERMISSION_UNDETERMINED'
    | 'NO_FRONT_CAMERA'
    | 'CAMERA_INIT_FAILED'
    | 'DETECTOR_INIT_FAILED'
    | 'FRAME_PROCESSING_FAILED';

export interface FaceDetectionError {
    code: FaceDetectionErrorCode;
    message: string;
}

// ─── Phase 1: Helpers ────────────────────────────────────────────────────────
export function facesToStatus(faces: DetectedFace[]): FaceDetectionStatus {
    if (faces.length === 0) return 'no-face';
    if (faces.length === 1) return 'one-face';
    return 'multiple-faces';
}

export const INITIAL_FACE_DETECTION_STATE: FaceDetectionState = {
    status: 'no-face',
    faces: [],
    isInitializing: true,
    error: null,
};

// ─── Phase 2: Face Quality ───────────────────────────────────────────────────

/**
 * Quality status codes. Only codes that can be reliably computed
 * from ML Kit bounding box + Euler angles are included.
 *
 * face-too-small   — face.bounds.width / frameWidth < MIN_FACE_SIZE_RATIO
 * face-too-large   — face.bounds.width / frameWidth > MAX_FACE_SIZE_RATIO
 * bad-pose         — |yaw| > MAX_YAW_DEG or |pitch| > MAX_PITCH_DEG or |roll| > MAX_ROLL_DEG
 * good             — all checks passed
 */
export type FaceQualityStatus =
    | 'good'
    | 'face-too-small'
    | 'face-too-large'
    | 'bad-pose';

export interface FaceQualityResult {
    status: FaceQualityStatus;
    /** Relative face width: bounds.width / frameWidth  (0..1) */
    relativeFaceWidth: number;
    /** Absolute Euler angles in degrees */
    yawAngle: number;
    pitchAngle: number;
    rollAngle: number;
}

// ─── Phase 2: Face Position ──────────────────────────────────────────────────

/**
 * Positional guidance codes. Evaluated in frame-space coordinates.
 *
 * centered        — face centre is within the acceptable centre region
 * too-far-left    — face centre is too far left in the frame
 * too-far-right   — face centre is too far right in the frame
 * too-high        — face centre is too high in the frame
 * too-low         — face centre is too low in the frame
 */
export type FacePositionStatus =
    | 'centered'
    | 'too-far-left'
    | 'too-far-right'
    | 'too-high'
    | 'too-low';

export interface FacePositionResult {
    status: FacePositionStatus;
    /** Normalised face centre (0..1 relative to frame dimensions) */
    normalisedCentreX: number;
    normalisedCentreY: number;
}

// ─── Phase 2: Capture Pipeline State ────────────────────────────────────────

export type FaceCaptureStatus =
    | 'idle'
    | 'evaluating'
    | 'stabilising'
    | 'capturing'
    | 'complete'
    | 'error';

// ─── Phase 2: Captured Frame ─────────────────────────────────────────────────
// Temporary in-memory representation. URI points to a local temp file.
// Clean up after alignment is complete.
export interface CapturedFaceFrame {
    id: string;
    /** Local file URI returned by capturePhoto */
    uri: string;
    /** Photo pixel dimensions */
    width: number;
    height: number;
    /**
     * ML Kit face detected on the captured photo (NOT the live preview face).
     * Landmarks are in photo-space coordinates.
     */
    face: DetectedFace;
}

// ─── Phase 2: Aligned Face ───────────────────────────────────────────────────
// Output of the alignment stage. Ready for a future ArcFace pipeline.
export interface AlignedFace {
    id: string;
    /** Local file URI of the aligned image */
    uri: string;
    /**
     * Output dimensions — always OUTPUT_SIZE × OUTPUT_SIZE pixels.
     * Defined in alignment/alignmentConfig.ts.
     */
    width: number;
    height: number;
    /** The source frame this was produced from */
    sourceFrameId: string;
}

// ─── Phase 2: Overall Enrollment State ──────────────────────────────────────
// High-level state consumed by the UI.
export interface FaceEnrollmentState {
    captureStatus: FaceCaptureStatus;
    qualityResult: FaceQualityResult | null;
    positionResult: FacePositionResult | null;
    /** Number of consecutive good frames (for stability display) */
    stableFrameCount: number;
    /** Target consecutive good frames before capture fires */
    stableFrameTarget: number;
    /** Accepted captured frames so far */
    capturedFrames: CapturedFaceFrame[];
    /** Target number of captured frames */
    targetFrameCount: number;
    /** Aligned faces produced from captured frames */
    alignedFaces: AlignedFace[];
    error: string | null;
}

export const INITIAL_ENROLLMENT_STATE: FaceEnrollmentState = {
    captureStatus: 'idle',
    qualityResult: null,
    positionResult: null,
    stableFrameCount: 0,
    stableFrameTarget: 5,
    capturedFrames: [],
    targetFrameCount: 5,
    alignedFaces: [],
    error: null,
};