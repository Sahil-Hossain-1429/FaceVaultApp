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
    STABLE_FRAME_TARGET: 5,
    TARGET_FRAME_COUNT: 5,
    MIN_CAPTURE_INTERVAL_MS: 1500,
    /** Block captures for this many ms after mount to let camera session open */
    CAMERA_WARMUP_MS: 3000,
} as const;

// ─── Landmark mapper ──────────────────────────────────────────────────────────

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
    photoOutput: CameraPhotoOutput;
    onDetectionState: (state: FaceDetectionState) => void;
    reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFaceCapture(): UseFaceCaptureReturn {
    const photoOutput = usePhotoOutput();
    const imageDetector = useImageFaceDetector({ runLandmarks: true });

    const [enrollmentState, setEnrollmentState] = useState<FaceEnrollmentState>(
        INITIAL_ENROLLMENT_STATE,
    );

    const stableCountRef = useRef(0);
    const capturedFramesRef = useRef<CapturedFaceFrame[]>([]);
    const captureStatusRef = useRef<FaceCaptureStatus>('idle');
    const lastCaptureTimeRef = useRef(0);
    const isCapturingRef = useRef(false);
    // Time-based warmup: record when the hook mounted
    const mountTimeRef = useRef(Date.now());

    const updateState = useCallback((partial: Partial<FaceEnrollmentState>) => {
        setEnrollmentState(prev => ({ ...prev, ...partial }));
    }, []);

    const reset = useCallback(() => {
        stableCountRef.current = 0;
        capturedFramesRef.current = [];
        captureStatusRef.current = 'idle';
        lastCaptureTimeRef.current = 0;
        isCapturingRef.current = false;
        mountTimeRef.current = Date.now(); // reset warmup timer
        setEnrollmentState(INITIAL_ENROLLMENT_STATE);
    }, []);

    // ── Photo capture ─────────────────────────────────────────────────────────
    const captureFrame = useCallback(async () => {
        console.log('[CaptureFrame] Attempting capture...');
        try {
            const photoFile = await photoOutput.capturePhotoToFile({}, {});
            console.log('[CaptureFrame] ✓ Got photo:', photoFile.filePath);

            const filePath = photoFile.filePath;
            const detectedFaces = imageDetector.detectFaces({ uri: filePath });

            if (detectedFaces.length !== 1) {
                console.warn(
                    `[Capture] Expected 1 face in captured photo, got ${detectedFaces.length}. Discarding.`,
                );
                return;
            }

            const face = mapImageFace(detectedFaces[0]);

            if (!face.landmarks?.LEFT_EYE || !face.landmarks?.RIGHT_EYE) {
                console.warn('[Capture] Captured photo missing eye landmarks. Discarding.');
                return;
            }

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

            console.log(`[Capture] Frame accepted — ${capturedCount}/${CAPTURE_CONFIG.TARGET_FRAME_COUNT}`);

            updateState({
                capturedFrames: [...capturedFramesRef.current],
                captureStatus: targetReached ? 'capturing' : 'evaluating',
            });

            if (targetReached) {
                captureStatusRef.current = 'capturing';
                updateState({ captureStatus: 'capturing' });

                try {
                    const alignedFaces = await alignAllFrames(capturedFramesRef.current);
                    console.log(`[Capture] Alignment complete — ${alignedFaces.length} faces`);
                    captureStatusRef.current = 'complete';
                    updateState({ captureStatus: 'complete', alignedFaces });
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Alignment failed';
                    console.error('[Capture] Alignment error:', e);
                    captureStatusRef.current = 'error';
                    updateState({ captureStatus: 'error', error: msg });
                }
            }
        } catch (e) {
            console.warn('[CaptureFrame] Failed:', e instanceof Error ? e.message : e);
        } finally {
            isCapturingRef.current = false;
        }
    }, [photoOutput, imageDetector, updateState]);

    // ── Main detection handler ────────────────────────────────────────────────
    const onDetectionState = useCallback(
        (detectionState: FaceDetectionState) => {
            if (
                captureStatusRef.current === 'complete' ||
                captureStatusRef.current === 'error' ||
                isCapturingRef.current
            ) return;

            const qualityResult = evaluateFaceQuality(detectionState);
            const positionResult = evaluateFacePosition(detectionState);

            const qualityGood = qualityResult?.status === 'good';
            const positionGood = positionResult?.status === 'centered';
            const frameGood = qualityGood && positionGood;

            if (frameGood) {
                stableCountRef.current += 1;
            } else {
                stableCountRef.current = 0;
            }

            const stableCount = stableCountRef.current;
            const isStable = stableCount >= CAPTURE_CONFIG.STABLE_FRAME_TARGET;
            const capturedCount = capturedFramesRef.current.length;
            const targetReached = capturedCount >= CAPTURE_CONFIG.TARGET_FRAME_COUNT;

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
                // Time-based warmup gate — wait for camera session to open
                const msSinceMount = Date.now() - mountTimeRef.current;
                if (msSinceMount < CAPTURE_CONFIG.CAMERA_WARMUP_MS) {
                    console.log(`[Capture] Warming up — ${Math.round(msSinceMount / 100) / 10}s / ${CAPTURE_CONFIG.CAMERA_WARMUP_MS / 1000}s`);
                    return;
                }

                const now = Date.now();
                if (now - lastCaptureTimeRef.current < CAPTURE_CONFIG.MIN_CAPTURE_INTERVAL_MS) {
                    return;
                }
                lastCaptureTimeRef.current = now;
                stableCountRef.current = 0;
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