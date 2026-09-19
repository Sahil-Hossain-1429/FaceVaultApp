// ─── Face Detection Status ───────────────────────────────────────────────────
// The three states the UI cares about.
export type FaceDetectionStatus =
    | 'no-face'
    | 'one-face'
    | 'multiple-faces';

// ─── Bounding Box ────────────────────────────────────────────────────────────
// Raw coordinates as returned by ML Kit (frame-space, not screen-space).
// These are NOT yet transformed to screen coordinates — that's a later phase.
export interface FaceBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ─── Detected Face ───────────────────────────────────────────────────────────
// Only fields that ML Kit reliably returns in fast/real-time mode.
// We do NOT include landmarks, contours, or classifications —
// those are disabled in the detector options for performance.
export interface DetectedFace {
    /** Unique tracking ID assigned by ML Kit (only available when trackingEnabled: true) */
    trackingId: number | null;
    /** Bounding box in frame coordinates (not screen coordinates) */
    bounds: FaceBoundingBox;
    /** Rotation of the face around the vertical axis (yaw), in degrees */
    rollAngle: number | null;
    /** Rotation of the face around the horizontal axis (pitch), in degrees */
    pitchAngle: number | null;
    /** Rotation of the face in the plane of the image (roll), in degrees */
    yawAngle: number | null;
}

// ─── Face Detection State ────────────────────────────────────────────────────
// The single object the UI consumes. Nothing else leaks out of the engine.
export interface FaceDetectionState {
    status: FaceDetectionStatus;
    faces: DetectedFace[];
    /** True while the camera/detector is initializing */
    isInitializing: boolean;
    /** Non-null if the detector encountered an unrecoverable error */
    error: FaceDetectionError | null;
}

// ─── Errors ──────────────────────────────────────────────────────────────────
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

// ─── Helper ──────────────────────────────────────────────────────────────────
// Pure function — no imports needed. Derives status from face count.
export function facesToStatus(faces: DetectedFace[]): FaceDetectionStatus {
    if (faces.length === 0) return 'no-face';
    if (faces.length === 1) return 'one-face';
    return 'multiple-faces';
}

// ─── Initial State ───────────────────────────────────────────────────────────
// Used to initialize hooks — defined here so the engine and UI
// always start from the same known state.
export const INITIAL_FACE_DETECTION_STATE: FaceDetectionState = {
    status: 'no-face',
    faces: [],
    isInitializing: true,
    error: null,
};