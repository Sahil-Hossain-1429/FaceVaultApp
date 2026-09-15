import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useFrameOutput,
} from 'react-native-vision-camera';
import type { Face } from 'react-native-vision-camera-face-detector';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';

// ─── Tokens (mirrors global.css) ───────────────────────────────────────────
const C = {
    bgMain: '#0E172A',
    bgDark: '#010617',
    surfaceDefault: '#1B293C',
    surfaceRaised: '#22334A',
    surfaceSelectedLight: '#122453',
    borderDefault: '#2F4157',
    borderStrong: '#43556B',
    primary: '#5FAEF7',
    primaryHover: '#57ABFB',
    textPrimary: '#F3F6F9',
    textWhite: '#FFFFFF',
    textSecondary: '#D4DDE7',
    textMuted: '#8698B4',
    textDisabled: '#60748D',
    successBg: '#002E16',
    success: '#006633',
    successGreen: '#38C97A',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────
type EnrollmentState =
    | 'idle'         // camera not yet ready
    | 'scanning'     // looking for a face
    | 'liveness'     // face found, waiting for blink
    | 'capturing'    // blink confirmed, capturing embedding
    | 'done'         // enrollment complete
    | 'error';       // something went wrong

interface StatusMessage {
    text: string;
    sub?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getStatusMessage(state: EnrollmentState, blinked: boolean): StatusMessage {
    switch (state) {
        case 'idle':
            return { text: 'Starting camera…' };
        case 'scanning':
            return {
                text: 'Position your face in the ring',
                sub: 'Keep your face centred and well-lit',
            };
        case 'liveness':
            return {
                text: blinked ? 'Blink detected!' : 'Blink once to confirm',
                sub: blinked ? 'Capturing your face…' : 'Natural blink — don\'t force it',
            };
        case 'capturing':
            return { text: 'Saving your face…', sub: 'Hold still for a moment' };
        case 'done':
            return { text: 'Face registered', sub: 'Your vault is ready to unlock' };
        case 'error':
            return { text: 'Something went wrong', sub: 'Tap Retry to try again' };
    }
}

// ─── Scan Ring ──────────────────────────────────────────────────────────────
interface ScanRingProps {
    state: EnrollmentState;
    spinValue: Animated.Value;
}

function ScanRing({ state, spinValue }: ScanRingProps) {
    const isDone = state === 'done';
    const isError = state === 'error';

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const ringColor = isDone ? C.successGreen : isError ? '#E8615C' : C.primary;

    return (
        <View style={styles.ringWrap}>
            {/* Spinning outer decoration */}
            <Animated.View
                style={[
                    styles.ringRotate,
                    { transform: [{ rotate: spin }] },
                ]}
            />

            {/* Static outer track */}
            <View style={[styles.ringTrack, { borderColor: C.surfaceRaised }]} />

            {/* Active arc */}
            <View
                style={[
                    styles.ringArc,
                    {
                        borderColor: ringColor,
                        opacity: isDone ? 1 : 0.9,
                    },
                ]}
            />

            {/* Inner dotted guide */}
            <View style={styles.ringDotted} />
        </View>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function FaceRecognitionSetup() {
    const insets = useSafeAreaInsets();
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('front');
    const camera = useRef<Camera>(null);

    const [enrollmentState, setEnrollmentState] = useState<EnrollmentState>('idle');
    const [blinked, setBlinked] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);

    // ── Refs to avoid stale closures inside worklet-bridged callbacks ─────────
    const enrollmentStateRef = useRef<EnrollmentState>('idle');
    const blinkedRef = useRef(false);

    // Keep refs in sync with state
    useEffect(() => { enrollmentStateRef.current = enrollmentState; }, [enrollmentState]);
    useEffect(() => { blinkedRef.current = blinked; }, [blinked]);

    // ── Debug state setter ────────────────────────────────────────────────────
    const setEnrollmentStateDebug = useCallback((newState: EnrollmentState) => {
        console.log(`[Enrollment] state: ${enrollmentStateRef.current} → ${newState}`);
        setEnrollmentState(newState);
    }, []);

    // ── Animation values ──────────────────────────────────────────────────────
    const spinValue = useRef(new Animated.Value(0)).current;
    const fadeIn = useRef(new Animated.Value(0)).current;
    const continueOpacity = useRef(new Animated.Value(0)).current;

    // ── Permission ────────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            if (!hasPermission) {
                const granted = await requestPermission();
                if (granted) setEnrollmentStateDebug('scanning');
                else setEnrollmentStateDebug('error');
            } else {
                setEnrollmentStateDebug('scanning');
            }
        })();
    }, [hasPermission]);

    // ── Spin animation ────────────────────────────────────────────────────────
    useEffect(() => {
        if (enrollmentState === 'scanning' || enrollmentState === 'liveness') {
            Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 3200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            spinValue.stopAnimation();
        }
    }, [enrollmentState]);

    // ── Fade in on mount ──────────────────────────────────────────────────────
    useEffect(() => {
        Animated.timing(fadeIn, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    // ── Animate Continue button when done ─────────────────────────────────────
    useEffect(() => {
        if (enrollmentState === 'done') {
            Animated.timing(continueOpacity, {
                toValue: 1,
                duration: 400,
                delay: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [enrollmentState]);

    // ── Capture & enroll ──────────────────────────────────────────────────────
    const startCapture = useCallback(async (face: Face) => {
        setEnrollmentStateDebug('capturing');
        try {
            const { enrollFace } = await import('@/services/faceEnrollment');
            await enrollFace(camera, face);
            setEnrollmentStateDebug('done');
        } catch (err) {
            console.error('[FaceRecognitionSetup] enrollment error:', err);
            setEnrollmentStateDebug('error');
        }
    }, []);

    // ── Face detection callback ───────────────────────────────────────────────
    // Defined before Worklets.createRunInJsFn — reads from refs to avoid
    // stale closures since the function is only created once.
    const handleFacesDetected = useCallback((faces: Face[]) => {
        const currentState = enrollmentStateRef.current;
        const alreadyBlinked = blinkedRef.current;

        console.log('[FaceDetect] faces:', faces.length, '| state:', currentState);

        // Ignore frames when we're done or mid-capture
        if (currentState === 'done' || currentState === 'capturing' || currentState === 'error') return;

        if (faces.length === 0) {
            setFaceDetected(false);
            if (currentState === 'liveness') setEnrollmentStateDebug('scanning');
            return;
        }

        const face = faces[0];

        console.log('[FaceDetect] leftEyeOpen:', face.leftEyeOpenProbability);
        console.log('[FaceDetect] rightEyeOpen:', face.rightEyeOpenProbability);

        setFaceDetected(true);

        // Face found — move to liveness check
        if (currentState === 'scanning') {
            setEnrollmentStateDebug('liveness');
            return;
        }

        // Liveness: wait for a natural blink (both eyes < 0.3)
        if (currentState === 'liveness' && !alreadyBlinked) {
            const leftEye = face.leftEyeOpenProbability ?? 1;
            const rightEye = face.rightEyeOpenProbability ?? 1;

            if (leftEye < 0.3 && rightEye < 0.3) {
                blinkedRef.current = true;
                setBlinked(true);

                setTimeout(() => {
                    startCapture(face);
                }, 600);
            }
        }
    }, [startCapture, setEnrollmentStateDebug]);

    // ── Bridge worklet thread → JS thread ────────────────────────────────────
    // useRef so it's created once and stays stable across renders
    const handleFacesDetectedJS = useMemo(
        () => Worklets.createRunOnJS(handleFacesDetected),
        [handleFacesDetected],
    );

    // ── Face detector — do NOT destructure hybrid object ─────────────────────
    const faceDetector = useFaceDetector({
        performanceMode: 'accurate',
        landmarkMode: 'all',
        classificationMode: 'all',
    });

    // const asyncRunner = useAsyncRunner();
    const frameOutput = useFrameOutput({
        pixelFormat: 'yuv',
        onFrame: (frame) => {
            'worklet';

            const faces = faceDetector.detectFaces(frame);
            handleFacesDetectedJS(faces);
        },
    });

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        setBlinked(false);
        setFaceDetected(false);
        setEnrollmentStateDebug('scanning');
    }, [setEnrollmentStateDebug]);

    const handleContinue = useCallback(() => {
        router.replace('/(tabs)/');
    }, []);

    // ── Derived UI ────────────────────────────────────────────────────────────
    const isDone = enrollmentState === 'done';
    const isError = enrollmentState === 'error';
    const isContinueEnabled = isDone;
    const status = getStatusMessage(enrollmentState, blinked);

    return (
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

            {/* ── Title ── */}
            <Animated.View style={[styles.titleBlock, { opacity: fadeIn }]}>
                <Text style={styles.title}>Register your face</Text>
                <Text style={styles.subtitle}>
                    Your face data stays on this device and is never shared.
                </Text>
            </Animated.View>

            {/* ── Scan ring + camera ── */}
            <View style={styles.ringArea}>
                {device && hasPermission && !isDone && (
                    <View style={styles.cameraClip}>
                        <Camera
                            ref={camera}
                            style={StyleSheet.absoluteFill}
                            device={device}
                            isActive={!isDone}
                            pixelFormat="yuv"
                            outputs={[frameOutput]}
                        />
                    </View>
                )}
                <ScanRing state={enrollmentState} spinValue={spinValue} />
            </View>

            {/* ── Status text ── */}
            <Animated.View style={[styles.statusBlock, { opacity: fadeIn }]}>
                <Text style={[
                    styles.statusText,
                    isDone && { color: C.successGreen },
                    isError && { color: '#E8615C' },
                ]}>
                    {status.text}
                </Text>
                {status.sub ? (
                    <Text style={styles.statusSub}>{status.sub}</Text>
                ) : null}
            </Animated.View>

            {/* ── Indicator dots ── */}
            {!isDone && !isError && (
                <View style={styles.indicatorRow}>
                    <View style={[
                        styles.indicatorDot,
                        faceDetected && { backgroundColor: C.primary },
                    ]} />
                    <View style={[
                        styles.indicatorDot,
                        blinked && { backgroundColor: C.successGreen },
                    ]} />
                </View>
            )}

            {/* ── Bottom actions ── */}
            <View style={styles.footer}>
                {isError ? (
                    <TouchableOpacity style={styles.btnPrimary} onPress={handleRetry}>
                        <Text style={styles.btnPrimaryText}>Retry</Text>
                    </TouchableOpacity>
                ) : (
                    <Animated.View style={{ width: '100%', opacity: isDone ? continueOpacity : 0.38 }}>
                        <TouchableOpacity
                            style={[
                                styles.btnPrimary,
                                !isContinueEnabled && styles.btnDisabled,
                            ]}
                            onPress={handleContinue}
                            disabled={!isContinueEnabled}
                            accessibilityState={{ disabled: !isContinueEnabled }}
                        >
                            <Text style={styles.btnPrimaryText}>Continue</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const RING_SIZE = 300;
const CAMERA_SIZE = RING_SIZE - 24;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bgMain,
        paddingHorizontal: 20,
    },

    // Title
    titleBlock: {
        marginTop: 20,
        marginBottom: 32,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: C.textWhite,
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: C.textMuted,
        lineHeight: 19,
    },

    // Ring area
    ringArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    ringWrap: {
        width: RING_SIZE,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    ringRotate: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
    },
    ringTrack: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 3,
    },
    ringArc: {
        position: 'absolute',
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 3,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        transform: [{ rotate: '-45deg' }],
    },
    ringDotted: {
        position: 'absolute',
        width: RING_SIZE - 32,
        height: RING_SIZE - 32,
        borderRadius: (RING_SIZE - 32) / 2,
        borderWidth: 1,
        borderColor: C.borderDefault,
        borderStyle: 'dashed',
    },

    // Camera
    cameraClip: {
        position: 'absolute',
        width: CAMERA_SIZE,
        height: CAMERA_SIZE,
        borderRadius: CAMERA_SIZE / 2,
        overflow: 'hidden',
        opacity: 0.65,
    },

    // Status
    statusBlock: {
        alignItems: 'center',
        marginBottom: 20,
        minHeight: 48,
    },
    statusText: {
        fontSize: 16.5,
        fontWeight: '700',
        color: C.textPrimary,
        textAlign: 'center',
        marginBottom: 4,
    },
    statusSub: {
        fontSize: 13,
        color: C.textMuted,
        textAlign: 'center',
        lineHeight: 18,
    },

    // Indicator dots
    indicatorRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 16,
    },
    indicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.borderStrong,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 20,
        right: 20,
        paddingBottom: 36,
    },
    btnPrimary: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 12,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnDisabled: {
        backgroundColor: C.primary,
    },
    btnPrimaryText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#04101f',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    },
});