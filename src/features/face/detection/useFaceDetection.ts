import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { Face as MLKitFace } from 'react-native-vision-camera-face-detector';
import {
    DetectedFace,
    DetectedFaceLandmarks,
    FaceDetectionError,
    FaceDetectionState,
    INITIAL_FACE_DETECTION_STATE,
    facesToStatus,
} from '../types';

const DETECTOR_OPTIONS = {
    performanceMode: 'fast',
    trackingEnabled: true,
    runLandmarks: true,
    runContours: false,
    runClassifications: false,
    minFaceSize: 0.15,
    cameraFacing: 'front',
} as const;

const STATE_UPDATE_THROTTLE_MS = 200;

function mapMLKitFace(face: MLKitFace): DetectedFace {
    let landmarks: DetectedFaceLandmarks | null = null;
    if (face.landmarks) {
        const l = face.landmarks;
        landmarks = {
            LEFT_EYE: l.LEFT_EYE ? { x: l.LEFT_EYE.x, y: l.LEFT_EYE.y } : undefined,
            RIGHT_EYE: l.RIGHT_EYE ? { x: l.RIGHT_EYE.x, y: l.RIGHT_EYE.y } : undefined,
            NOSE_BASE: l.NOSE_BASE ? { x: l.NOSE_BASE.x, y: l.NOSE_BASE.y } : undefined,
            MOUTH_LEFT: l.MOUTH_LEFT ? { x: l.MOUTH_LEFT.x, y: l.MOUTH_LEFT.y } : undefined,
            MOUTH_RIGHT: l.MOUTH_RIGHT ? { x: l.MOUTH_RIGHT.x, y: l.MOUTH_RIGHT.y } : undefined,
            MOUTH_BOTTOM: l.MOUTH_BOTTOM ? { x: l.MOUTH_BOTTOM.x, y: l.MOUTH_BOTTOM.y } : undefined,
            LEFT_EAR: l.LEFT_EAR ? { x: l.LEFT_EAR.x, y: l.LEFT_EAR.y } : undefined,
            RIGHT_EAR: l.RIGHT_EAR ? { x: l.RIGHT_EAR.x, y: l.RIGHT_EAR.y } : undefined,
            LEFT_CHEEK: l.LEFT_CHEEK ? { x: l.LEFT_CHEEK.x, y: l.LEFT_CHEEK.y } : undefined,
            RIGHT_CHEEK: l.RIGHT_CHEEK ? { x: l.RIGHT_CHEEK.x, y: l.RIGHT_CHEEK.y } : undefined,
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

    // ── Memoize cameraProps so Camera never sees a new object reference ───────
    // A new object on every render triggers VisionCamera to reconfigure the
    // session, which closes the camera mid-capture ("Camera is closed").
    const cameraProps = useMemo(() => ({
        onFacesDetected: handleFacesDetected,
        onError: handleDetectorError,
        performanceMode: DETECTOR_OPTIONS.performanceMode,
        trackingEnabled: DETECTOR_OPTIONS.trackingEnabled,
        runLandmarks: DETECTOR_OPTIONS.runLandmarks,
        runContours: DETECTOR_OPTIONS.runContours,
        runClassifications: DETECTOR_OPTIONS.runClassifications,
        minFaceSize: DETECTOR_OPTIONS.minFaceSize,
        cameraFacing: DETECTOR_OPTIONS.cameraFacing,
    }), [handleFacesDetected, handleDetectorError]);

    return {
        detectionState: INITIAL_FACE_DETECTION_STATE,
        cameraProps,
        device,
        hasPermission,
        requestPermission,
    };
}