import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Camera } from 'react-native-vision-camera-face-detector';
import { useFaceCamera } from './camera/useFaceCamera';
import { useFaceCapture } from './capture/useFaceCapture';
import { useFaceDetection } from './detection/useFaceDetection';
import type { FaceDetectionState } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STABILITY_TARGET = 5;   // stableFrameTarget to consider "verified"
const VERIFICATION_LABEL = 'Hold still to verify…';

const CAPTURE_STATUS_COLORS: Record<string, string> = {
    'idle': '#888',
    'evaluating': '#FFD43B',
    'stabilising': '#74C0FC',
    'capturing': '#FF922B',
    'complete': '#51CF66',
    'error': '#FF6B6B',
};

const QUALITY_LABELS: Record<string, string> = {
    'good': '✓ Quality OK',
    'face-too-small': 'Move closer',
    'face-too-large': 'Move farther away',
    'bad-pose': 'Look straight at the camera',
};

const POSITION_LABELS: Record<string, string> = {
    'centered': '✓ Centered',
    'too-far-left': 'Move right',
    'too-far-right': 'Move left',
    'too-high': 'Move down',
    'too-low': 'Move up',
};

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * idle       → camera active, waiting for stable face
 * verifying  → stability reached, running mock check
 * failed     → this attempt failed; user can retry
 * success    → all attempts exhausted in "correct" direction → navigate away
 */
type VerificationPhase = 'idle' | 'verifying' | 'failed' | 'success';

// ── Component ─────────────────────────────────────────────────────────────────

export function FaceVerificationScreen() {
    const router = useRouter();

    // ── Camera / capture (same hooks as enrollment) ───────────────────────────
    const faceCamera = useFaceCamera();
    const { enrollmentState, photoOutput, onDetectionState, reset } = useFaceCapture();
    const outputs = useMemo(() => [photoOutput], [photoOutput]);

    const [detectionState, setDetectionState] = useState<FaceDetectionState>({
        status: 'no-face',
        faces: [],
        isInitializing: true,
        error: null,
    });

    // ── Verification state ────────────────────────────────────────────────────
    const [phase, setPhase] = useState<VerificationPhase>('idle');

    /**
     * failsRemaining is set once on first stability hit:
     *   0 → pass immediately
     *   1 → fail once, then pass
     *   2 → fail twice, then pass
     */
    const failsRemainingRef = useRef<number | null>(null);
    const [failCount, setFailCount] = useState(0);   // how many times we've shown "failed"
    const prevWasAtTarget = useRef(false);

    // Seed random fail count on mount (0, 1, or 2)
    useEffect(() => {
        failsRemainingRef.current = Math.floor(Math.random() * 3) as 0 | 1 | 2;
        console.log('[VerifyScreen] failsRemaining seeded:', failsRemainingRef.current);
    }, []);

    // ── Watch stability → trigger verification ────────────────────────────────
    useEffect(() => {
        if (phase !== 'idle') return;

        const { stableFrameCount, stableFrameTarget } = enrollmentState;
        const isAtTarget = stableFrameTarget > 0 && stableFrameCount >= stableFrameTarget;

        if (isAtTarget && !prevWasAtTarget.current) {
            // Rising edge — stability just hit full
            setPhase('verifying');
        }

        prevWasAtTarget.current = isAtTarget;
    }, [enrollmentState.stableFrameCount, enrollmentState.stableFrameTarget, phase]);

    // ── Process "verifying" phase ─────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'verifying') return;

        // Small delay to show the "Verifying…" state briefly
        const timer = setTimeout(() => {
            const remaining = failsRemainingRef.current ?? 0;

            if (remaining > 0) {
                // Consume one failure
                failsRemainingRef.current = remaining - 1;
                setFailCount(prev => prev + 1);
                setPhase('failed');
            } else {
                setPhase('success');
            }
        }, 1200);

        return () => clearTimeout(timer);
    }, [phase]);

    // ── Navigate on success ───────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'success') return;

        const timer = setTimeout(() => {
            router.replace('/(tabs)/');
        }, 800); // brief success flash before navigating

        return () => clearTimeout(timer);
    }, [phase, router]);

    // ── Detection handler ─────────────────────────────────────────────────────
    const handleDetectionStateChange = useCallback(
        (nextState: FaceDetectionState) => {
            setDetectionState(nextState);
            onDetectionState(nextState);
        },
        [onDetectionState],
    );

    const { cameraProps, device } = useFaceDetection(handleDetectionStateChange);

    // ── Try again ─────────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        reset();
        prevWasAtTarget.current = false;
        setPhase('idle');
    }, [reset]);

    // ── Permission / hardware gates (same pattern as enrollment) ─────────────
    if (faceCamera.permissionStatus === 'undetermined') {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    FaceVault needs camera access to verify your face.
                </Text>
                <TouchableOpacity style={styles.button} onPress={faceCamera.requestPermission}>
                    <Text style={styles.buttonText}>Grant Camera Permission</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (faceCamera.permissionStatus === 'denied') {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    Camera permission was denied.{'\n'}
                    Please enable it in your device Settings.
                </Text>
            </SafeAreaView>
        );
    }

    if (!faceCamera.hasFrontCamera || !device) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>No front-facing camera found.</Text>
            </SafeAreaView>
        );
    }

    if (detectionState.isInitializing) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>Initializing camera…</Text>
            </SafeAreaView>
        );
    }

    if (detectionState.error) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.errorCode}>{detectionState.error.code}</Text>
                <Text style={styles.message}>{detectionState.error.message}</Text>
            </SafeAreaView>
        );
    }

    // ── Derive badge content from current phase ───────────────────────────────
    const { qualityResult, positionResult, captureStatus, stableFrameCount, stableFrameTarget } = enrollmentState;
    const statusColor = CAPTURE_STATUS_COLORS[captureStatus] ?? '#888';

    const badgeColor =
        phase === 'failed' ? '#FF6B6B' :
            phase === 'verifying' ? '#74C0FC' :
                phase === 'success' ? '#51CF66' :
                    statusColor;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            <Camera
                outputs={outputs}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={phase === 'idle'}        // pause camera when not scanning
                onFacesDetected={cameraProps.onFacesDetected}
                onError={cameraProps.onError}
                performanceMode={cameraProps.performanceMode}
                trackingEnabled={cameraProps.trackingEnabled}
                runLandmarks={cameraProps.runLandmarks}
                runContours={cameraProps.runContours}
                runClassifications={cameraProps.runClassifications}
                minFaceSize={cameraProps.minFaceSize}
                cameraFacing={cameraProps.cameraFacing}
            />

            <SafeAreaView style={styles.overlay} pointerEvents="box-none">

                {/* ── Title ── */}
                <View style={styles.titleArea}>
                    <Text style={styles.title}>Face Verification</Text>
                    <Text style={styles.subtitle}>
                        {phase === 'idle' && 'Position your face in the frame'}
                        {phase === 'verifying' && 'Verifying your identity…'}
                        {phase === 'failed' && 'Verification failed'}
                        {phase === 'success' && 'Identity confirmed'}
                    </Text>
                </View>

                {/* ── Status badge ── */}
                <View style={[styles.badge, { borderColor: badgeColor }]}>

                    {phase === 'idle' && (
                        <>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {VERIFICATION_LABEL}
                            </Text>
                            <Text style={styles.debug}>
                                Stability: {stableFrameCount} / {stableFrameTarget}
                            </Text>
                            {qualityResult && (
                                <Text style={[
                                    styles.debug,
                                    { color: qualityResult.status === 'good' ? '#51CF66' : '#FFD43B' },
                                ]}>
                                    Quality: {QUALITY_LABELS[qualityResult.status] ?? qualityResult.status}
                                </Text>
                            )}
                            {positionResult && (
                                <Text style={[
                                    styles.debug,
                                    { color: positionResult.status === 'centered' ? '#51CF66' : '#FFD43B' },
                                ]}>
                                    Position: {POSITION_LABELS[positionResult.status] ?? positionResult.status}
                                </Text>
                            )}
                            <Text style={styles.debug}>
                                Faces: {detectionState.faces.length}{'  '}
                                Status: {detectionState.status}
                            </Text>
                            {detectionState.faces.length === 1 && (
                                <Text style={styles.debug}>
                                    yaw={detectionState.faces[0].yawAngle?.toFixed(1)}°{'  '}
                                    pitch={detectionState.faces[0].pitchAngle?.toFixed(1)}°{'  '}
                                    roll={detectionState.faces[0].rollAngle?.toFixed(1)}°
                                </Text>
                            )}
                            {enrollmentState.error && (
                                <Text style={[styles.debug, { color: '#FF6B6B' }]}>
                                    {enrollmentState.error}
                                </Text>
                            )}
                        </>
                    )}

                    {phase === 'verifying' && (
                        <Text style={[styles.statusText, { color: '#74C0FC' }]}>
                            Verifying…
                        </Text>
                    )}

                    {phase === 'failed' && (
                        <>
                            <Text style={[styles.statusText, { color: '#FF6B6B' }]}>
                                Face cannot be verified, try again
                            </Text>
                            {failCount > 0 && (
                                <Text style={styles.debug}>
                                    Attempt {failCount} failed
                                </Text>
                            )}
                        </>
                    )}

                    {phase === 'success' && (
                        <Text style={[styles.statusText, { color: '#51CF66' }]}>
                            ✓ Verified
                        </Text>
                    )}

                </View>

                {/* ── Try Again button (only on failure) ── */}
                {phase === 'failed' && (
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                )}

            </SafeAreaView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: {
        flex: 1,
        backgroundColor: '#0E172A',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: Platform.OS === 'android' ? 32 : 16,
    },
    titleArea: {
        marginTop: 16,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 12,
        minWidth: 280,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
    },
    badge: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        minWidth: 280,
        gap: 4,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    debug: {
        fontSize: 11,
        color: '#aaa',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    retryButton: {
        backgroundColor: '#4A90D9',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 10,
        minWidth: 280,
        alignItems: 'center',
        marginTop: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    message: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    errorCode: {
        color: '#FF6B6B',
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 8,
    },
    button: {
        backgroundColor: '#4A90D9',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 10,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});