import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Camera } from 'react-native-vision-camera-face-detector';
import { testSupabaseAuth } from '../../lib/supabase';
import { useFaceCamera } from './camera/useFaceCamera';
import { useFaceCapture } from './capture/useFaceCapture';
import { useFaceDetection } from './detection/useFaceDetection';
import { saveEnrollmentTemplate } from './enrollment/enrollmentRepository';
import { buildEnrollmentTemplate, warmUpEmbeddingModel } from './enrollment/enrollmentService';
import type { FaceDetectionState } from './types';

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

const CAPTURE_STATUS_LABELS: Record<string, string> = {
    'idle': 'Waiting…',
    'evaluating': 'Evaluating face…',
    'stabilising': 'Hold still…',
    'capturing': 'Capturing…',
    'complete': '✓ Complete',
    'error': '✗ Error',
};

const CAPTURE_STATUS_COLORS: Record<string, string> = {
    'idle': '#888',
    'evaluating': '#FFD43B',
    'stabilising': '#74C0FC',
    'capturing': '#FF922B',
    'complete': '#51CF66',
    'error': '#FF6B6B',
};

const DUMMY_CAPTURE_TARGET = 5;

type EmbeddingPhase = 'idle' | 'embedding' | 'saving' | 'done' | 'error';

export function FaceEnrollmentDevScreen() {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { userId, getToken } = useAuth();
    const router = useRouter();

    // ── Camera / capture ──────────────────────────────────────────────────────
    const faceCamera = useFaceCamera();
    const { enrollmentState, photoOutput, onDetectionState, reset } = useFaceCapture();
    const outputs = useMemo(() => [photoOutput], [photoOutput]);

    const [detectionState, setDetectionState] = useState<FaceDetectionState>({
        status: 'no-face',
        faces: [],
        isInitializing: true,
        error: null,
    });

    // ── Dummy capture count ───────────────────────────────────────────────────
    // Increments by 1 each time stability reaches stableFrameTarget (5/5).
    // Resets when the real capture resets.
    const [dummyCaptureCount, setDummyCaptureCount] = useState(0);
    const prevStableCount = useRef(0);
    const prevWasAtTarget = useRef(false);

    useEffect(() => {
        const { stableFrameCount, stableFrameTarget } = enrollmentState;
        const isAtTarget = stableFrameCount >= stableFrameTarget && stableFrameTarget > 0;

        // Rising edge: stability just reached the target
        if (isAtTarget && !prevWasAtTarget.current) {
            setDummyCaptureCount(prev => Math.min(prev + 1, DUMMY_CAPTURE_TARGET));
        }

        prevWasAtTarget.current = isAtTarget;
        prevStableCount.current = stableFrameCount;
    }, [enrollmentState.stableFrameCount, enrollmentState.stableFrameTarget]);

    const enrollmentSuccess = dummyCaptureCount >= DUMMY_CAPTURE_TARGET;

    // ── Phase 3 state ─────────────────────────────────────────────────────────
    const [embeddingPhase, setEmbeddingPhase] = useState<EmbeddingPhase>('idle');
    const [embeddingError, setEmbeddingError] = useState<string | null>(null);
    const [frameCount, setFrameCount] = useState<number | null>(null);

    // ── On mount: test Supabase + warm up model ───────────────────────────────
    useEffect(() => {
        const init = async () => {
            const token = await getToken({ template: 'supabase' });
            console.log('[DevScreen] Clerk token on mount:', token ? `${token.slice(0, 20)}...` : 'NULL');
            await testSupabaseAuth(token ?? undefined);
            setTimeout(() => {
                warmUpEmbeddingModel().catch(e =>
                    console.warn('[DevScreen] Model warm-up failed:', e),
                );
            }, 2000);
        };
        init();
    }, []);

    // ── Phase 3: trigger when capture completes ───────────────────────────────
    useEffect(() => {
        console.log('[DevScreen] captureStatus:', enrollmentState.captureStatus);
        console.log('[DevScreen] alignedFaces count:', enrollmentState.alignedFaces.length);
        console.log('[DevScreen] embeddingPhase:', embeddingPhase);
        console.log('[DevScreen] userId:', userId);

        if (enrollmentState.captureStatus !== 'complete') return;
        if (embeddingPhase !== 'idle') return;
        if (!userId) {
            console.warn('[DevScreen] No userId — Clerk not ready or user not signed in');
            return;
        }

        console.log('[DevScreen] ✓ All conditions met, starting Phase 3');

        const run = async () => {
            try {
                const token = await getToken({ template: 'supabase' });
                console.log('[DevScreen] Clerk token for save:', token ? `${token.slice(0, 20)}...` : 'NULL');

                if (!token) {
                    throw new Error('Clerk token is null — is the user signed in?');
                }

                setEmbeddingPhase('embedding');
                const template = await buildEnrollmentTemplate(enrollmentState.alignedFaces);
                setFrameCount(template.frameCount);

                setEmbeddingPhase('saving');
                await saveEnrollmentTemplate(userId, token, template);

                setEmbeddingPhase('done');
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Unknown error';
                console.error('[DevScreen] Phase 3 error:', e);
                setEmbeddingError(msg);
                setEmbeddingPhase('error');
            }
        };

        run();
    }, [enrollmentState.captureStatus, embeddingPhase, userId, enrollmentState.alignedFaces]);

    // ── Detection handler ─────────────────────────────────────────────────────
    const handleDetectionStateChange = useCallback(
        (nextState: FaceDetectionState) => {
            setDetectionState(nextState);
            onDetectionState(nextState);
        },
        [onDetectionState],
    );

    const { cameraProps, device } = useFaceDetection(handleDetectionStateChange);

    const handleReset = useCallback(() => {
        reset();
        setEmbeddingPhase('idle');
        setEmbeddingError(null);
        setFrameCount(null);
        setDummyCaptureCount(0);
        prevWasAtTarget.current = false;
        prevStableCount.current = 0;
    }, [reset]);

    const handleContinue = useCallback(() => {
        router.replace('/(tabs)');
    }, [router]);

    // ── Permission gates ──────────────────────────────────────────────────────
    if (faceCamera.permissionStatus === 'undetermined') {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    FaceVault needs camera access to detect your face.
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

    // ── Complete screen ───────────────────────────────────────────────────────
    if (enrollmentState.captureStatus === 'complete') {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.completeTitle}>✓ Alignment Complete</Text>
                <Text style={styles.completeSubtitle}>
                    {enrollmentState.alignedFaces.length} aligned frames
                </Text>

                <ScrollView
                    horizontal
                    style={styles.alignedRow}
                    contentContainerStyle={styles.alignedRowContent}
                >
                    {enrollmentState.alignedFaces.map(face => (
                        <View key={face.id} style={styles.alignedFrame}>
                            <Image
                                source={{ uri: `file://${face.uri}` }}
                                style={styles.alignedImage}
                                resizeMode="cover"
                            />
                            <Text style={styles.alignedLabel}>
                                {face.width}×{face.height}
                            </Text>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.phase3Box}>
                    {embeddingPhase === 'idle' && (
                        <ActivityIndicator color="#888" />
                    )}
                    {embeddingPhase === 'embedding' && (
                        <>
                            <ActivityIndicator color="#74C0FC" style={{ marginBottom: 8 }} />
                            <Text style={styles.phase3Text}>Running ArcFace inference…</Text>
                        </>
                    )}
                    {embeddingPhase === 'saving' && (
                        <>
                            <ActivityIndicator color="#FF922B" style={{ marginBottom: 8 }} />
                            <Text style={styles.phase3Text}>Saving template to Supabase…</Text>
                        </>
                    )}
                    {embeddingPhase === 'done' && (
                        <Text style={[styles.phase3Text, { color: '#51CF66' }]}>
                            ✓ Enrolled — {frameCount} frame{frameCount !== 1 ? 's' : ''} averaged
                        </Text>
                    )}
                    {embeddingPhase === 'error' && (
                        <Text style={[styles.phase3Text, { color: '#FF6B6B' }]}>
                            ✗ {embeddingError}
                        </Text>
                    )}
                </View>

                <TouchableOpacity style={styles.button} onPress={handleReset}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ── Live camera ───────────────────────────────────────────────────────────
    const { qualityResult, positionResult, captureStatus } = enrollmentState;
    const statusColor = CAPTURE_STATUS_COLORS[captureStatus] ?? '#888';

    return (
        <View style={styles.container}>
            <Camera
                outputs={outputs}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
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
                {/* Status / capture badge */}
                <View style={[styles.badge, { borderColor: enrollmentSuccess ? '#51CF66' : statusColor }]}>
                    {enrollmentSuccess ? (
                        <Text style={styles.successText}>Face Enrollment successful</Text>
                    ) : (
                        <>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {CAPTURE_STATUS_LABELS[captureStatus] ?? captureStatus}
                            </Text>
                            <Text style={styles.debug}>
                                Captured: {dummyCaptureCount} / {DUMMY_CAPTURE_TARGET}
                            </Text>
                            <Text style={styles.debug}>
                                Stability: {enrollmentState.stableFrameCount} / {enrollmentState.stableFrameTarget}
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
                </View>

                {/* Continue button */}
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        !enrollmentSuccess && styles.continueButtonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={!enrollmentSuccess}
                    activeOpacity={0.8}
                >
                    <Text style={[
                        styles.continueButtonText,
                        !enrollmentSuccess && styles.continueButtonTextDisabled,
                    ]}>
                        Continue
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

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
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: Platform.OS === 'android' ? 24 : 8,
    },
    badge: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        minWidth: 280,
        marginBottom: 12,
        gap: 4,
    },
    statusText: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    successText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#51CF66',
        textAlign: 'center',
    },
    debug: {
        fontSize: 11,
        color: '#aaa',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    message: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 },
    errorCode: {
        color: '#FF6B6B',
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 8,
    },
    button: { backgroundColor: '#4A90D9', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    continueButton: {
        backgroundColor: '#4A90D9',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 10,
        marginBottom: 8,
        minWidth: 280,
        alignItems: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: '#2A3A4A',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    continueButtonTextDisabled: {
        color: '#556070',
    },
    completeTitle: { color: '#51CF66', fontSize: 24, fontWeight: '700', marginBottom: 8 },
    completeSubtitle: { color: '#aaa', fontSize: 14, marginBottom: 24 },
    alignedRow: { maxHeight: 180, marginBottom: 16 },
    alignedRowContent: { gap: 12, paddingHorizontal: 8 },
    alignedFrame: { alignItems: 'center', gap: 4 },
    alignedImage: { width: 112, height: 112, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
    alignedLabel: {
        color: '#888',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    phase3Box: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 24,
        minHeight: 60,
        justifyContent: 'center',
    },
    phase3Text: { color: '#ccc', fontSize: 14, textAlign: 'center' },
});