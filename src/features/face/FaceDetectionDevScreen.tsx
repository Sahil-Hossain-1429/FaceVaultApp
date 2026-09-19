import { useCallback, useState } from 'react';
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
import { useFaceDetection } from './detection/useFaceDetection';
import {
    FaceDetectionState,
    INITIAL_FACE_DETECTION_STATE,
} from './types';

// ─── Status display config ────────────────────────────────────────────────────
// Maps detection status → { label, color }
// UI wording lives here, not in the detection engine.
const STATUS_CONFIG = {
    'no-face': {
        label: 'No face detected',
        color: '#FF6B6B',
    },
    'one-face': {
        label: 'Face detected ✓',
        color: '#51CF66',
    },
    'multiple-faces': {
        label: 'Only one person should be visible',
        color: '#FFD43B',
    },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function FaceDetectionDevScreen() {
    const faceCamera = useFaceCamera();

    const [detectionState, setDetectionState] = useState<FaceDetectionState>(
        INITIAL_FACE_DETECTION_STATE,
    );

    // Stable callback — passed to useFaceDetection to receive state updates.
    // Lives here (in the screen) so the screen controls its own render cycle.
    const handleDetectionStateChange = useCallback(
        (nextState: FaceDetectionState) => {
            setDetectionState(nextState);
        },
        [],
    );

    const { cameraProps, device } = useFaceDetection(handleDetectionStateChange);

    // ─── Permission not yet requested ───────────────────────────────────────
    if (faceCamera.permissionStatus === 'undetermined') {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    FaceVault needs camera access to detect your face.
                </Text>
                <TouchableOpacity
                    style={styles.button}
                    onPress={faceCamera.requestPermission}
                >
                    <Text style={styles.buttonText}>Grant Camera Permission</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ─── Permission denied ───────────────────────────────────────────────────
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

    // ─── No front camera ─────────────────────────────────────────────────────
    if (!faceCamera.hasFrontCamera || !device) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    No front-facing camera found on this device.
                </Text>
            </SafeAreaView>
        );
    }

    // ─── Initializing ────────────────────────────────────────────────────────
    if (detectionState.isInitializing) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>Initializing camera…</Text>
            </SafeAreaView>
        );
    }

    // ─── Detection error ─────────────────────────────────────────────────────
    if (detectionState.error) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.errorCode}>{detectionState.error.code}</Text>
                <Text style={styles.message}>{detectionState.error.message}</Text>
            </SafeAreaView>
        );
    }

    // ─── Camera live ─────────────────────────────────────────────────────────
    const statusConfig = STATUS_CONFIG[detectionState.status];

    return (
        <View style={styles.container}>
            {/* Camera preview — fills the screen */}
            <Camera
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

            {/* Dev overlay — status badge at the bottom */}
            <SafeAreaView style={styles.overlay} pointerEvents="none">
                <View style={[styles.statusBadge, { borderColor: statusConfig.color }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                    <Text style={styles.debugText}>
                        faces: {detectionState.faces.length}
                        {'  '}status: {detectionState.status}
                    </Text>
                    {detectionState.faces.length === 1 && (
                        <Text style={styles.debugText}>
                            bounds: x={Math.round(detectionState.faces[0].bounds.x)}{' '}
                            y={Math.round(detectionState.faces[0].bounds.y)}{' '}
                            w={Math.round(detectionState.faces[0].bounds.width)}{' '}
                            h={Math.round(detectionState.faces[0].bounds.height)}
                        </Text>
                    )}
                    {detectionState.faces.length === 1 &&
                        detectionState.faces[0].trackingId !== null && (
                            <Text style={styles.debugText}>
                                trackingId: {detectionState.faces[0].trackingId}
                            </Text>
                        )}
                </View>
            </SafeAreaView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
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
    statusBadge: {
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        minWidth: 260,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    debugText: {
        fontSize: 11,
        color: '#aaa',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
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
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});