import { useCallback, useEffect, useRef } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { Face as MLKitFace } from 'react-native-vision-camera-face-detector';
import {
    DetectedFace,
    FaceDetectionError,
    FaceDetectionState,
    INITIAL_FACE_DETECTION_STATE,
    facesToStatus,
} from '../types';

// ─── ML Kit Options ──────────────────────────────────────────────────────────
const DETECTOR_OPTIONS = {
    performanceMode: 'fast',
    trackingEnabled: true,
    runLandmarks: false,
    runContours: false,
    runClassifications: false,
    minFaceSize: 0.15,
    cameraFacing: 'front',
} as const;

// ─── Throttle ────────────────────────────────────────────────────────────────
const STATE_UPDATE_THROTTLE_MS = 200;

// ─── Mapper ──────────────────────────────────────────────────────────────────
function mapMLKitFace(face: MLKitFace): DetectedFace {
    return {
        trackingId: face.trackingId ?? null,
        bounds: {
            x: face.bounds.x,
            y: face.bounds.y,
            width: face.bounds.width,
            height: face.bounds.height,
        },
        rollAngle: face.rollAngle ?? null,
        pitchAngle: face.pitchAngle ?? null,
        yawAngle: face.yawAngle ?? null,
    };
}

// ─── Hook Interface ──────────────────────────────────────────────────────────
export interface UseFaceDetectionReturn {
    detectionState: FaceDetectionState;
    cameraProps: {
        onFacesDetected: (faces: MLKitFace[]) => void;
        onError: (error: unknown) => void;
        performanceMode: typeof DETECTOR_OPTIONS['performanceMode'];
        trackingEnabled: typeof DETECTOR_OPTIONS['trackingEnabled'];
        runLandmarks: typeof DETECTOR_OPTIONS['runLandmarks'];
        runContours: typeof DETECTOR_OPTIONS['runContours'];
        runClassifications: typeof DETECTOR_OPTIONS['runClassifications'];
        minFaceSize: typeof DETECTOR_OPTIONS['minFaceSize'];
        cameraFacing: typeof DETECTOR_OPTIONS['cameraFacing'];
    };
    device: ReturnType<typeof useCameraDevice>;
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useFaceDetection(
    onStateChange: (state: FaceDetectionState) => void,
): UseFaceDetectionReturn {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('front');

    const lastUpdateTimeRef = useRef<number>(0);
    const isMountedRef = useRef<boolean>(true);

    const pushState = useCallback(
        (nextState: FaceDetectionState) => {
            if (!isMountedRef.current) return;
            const now = Date.now();
            if (now - lastUpdateTimeRef.current < STATE_UPDATE_THROTTLE_MS) return;
            lastUpdateTimeRef.current = now;
            onStateChange(nextState);
        },
        [onStateChange],
    );

    useEffect(() => {
        isMountedRef.current = true;

        if (!hasPermission) {
            pushState({
                ...INITIAL_FACE_DETECTION_STATE,
                isInitializing: false,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Camera permission has not been granted.',
                },
            });
            return;
        }

        if (!device) {
            pushState({
                ...INITIAL_FACE_DETECTION_STATE,
                isInitializing: false,
                error: {
                    code: 'NO_FRONT_CAMERA',
                    message: 'No front-facing camera was found on this device.',
                },
            });
            return;
        }

        pushState({
            ...INITIAL_FACE_DETECTION_STATE,
            isInitializing: false,
            error: null,
        });

        return () => {
            isMountedRef.current = false;
        };
    }, [hasPermission, device, pushState]);

    // ─── Face callback ───────────────────────────────────────────────────────
    const handleFacesDetected = useCallback(
        (mlkitFaces: MLKitFace[]) => {
            if (!isMountedRef.current) return;

            let detectedFaces: DetectedFace[] = [];
            let error: FaceDetectionError | null = null;

            try {
                detectedFaces = mlkitFaces.map(mapMLKitFace);
            } catch (e) {
                console.warn('[FaceDetection] Failed to map ML Kit face data:', e);
                error = {
                    code: 'FRAME_PROCESSING_FAILED',
                    message: e instanceof Error ? e.message : 'Unknown frame processing error',
                };
            }

            pushState({
                status: facesToStatus(detectedFaces),
                faces: detectedFaces,
                isInitializing: false,
                error,
            });
        },
        [pushState],
    );

    // ─── Error callback ──────────────────────────────────────────────────────
    const handleDetectorError = useCallback(
        (error: unknown) => {
            console.warn('[FaceDetection] ML Kit error:', error);
            pushState({
                status: 'no-face',
                faces: [],
                isInitializing: false,
                error: {
                    code: 'DETECTOR_INIT_FAILED',
                    message: error instanceof Error ? error.message : 'ML Kit face detector failed',
                },
            });
        },
        [pushState],
    );

    return {
        detectionState: INITIAL_FACE_DETECTION_STATE,
        cameraProps: {
            onFacesDetected: handleFacesDetected,
            onError: handleDetectorError,
            performanceMode: DETECTOR_OPTIONS.performanceMode,
            trackingEnabled: DETECTOR_OPTIONS.trackingEnabled,
            runLandmarks: DETECTOR_OPTIONS.runLandmarks,
            runContours: DETECTOR_OPTIONS.runContours,
            runClassifications: DETECTOR_OPTIONS.runClassifications,
            minFaceSize: DETECTOR_OPTIONS.minFaceSize,
            cameraFacing: DETECTOR_OPTIONS.cameraFacing,
        },
        device,
        hasPermission,
        requestPermission,
    };
}