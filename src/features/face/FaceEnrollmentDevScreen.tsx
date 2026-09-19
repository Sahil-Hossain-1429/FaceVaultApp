import { useCallback, useState } from 'react';
import {
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
import { useFaceCamera } from './camera/useFaceCamera';
import { useFaceCapture } from './capture/useFaceCapture';
import { useFaceDetection } from './detection/useFaceDetection';
import type { FaceDetectionState } from './types';

// ─── Status label maps ────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function FaceEnrollmentDevScreen() {
    const faceCamera = useFaceCamera();
    const { enrollmentState, photoOutput, onDetectionState, reset } = useFaceCapture();

    const [detectionState, setDetectionState] = useState<FaceDetectionState>({
        status: 'no-face',
        faces: [],
        isInitializing: true,
        error: null,
    });

    // Wire detection state into both the UI and the capture pipeline.
    const handleDetectionStateChange = useCallback(
        (nextState: FaceDetectionState) => {
            setDetectionState(nextState);
            onDetectionState(nextState);
        },
        [onDetectionState],
    );

    const { cameraProps, device } = useFaceDetection(handleDetectionStateChange);

    // ── Permission: undetermined ──────────────────────────────────────────────
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

    // ── Permission: denied ────────────────────────────────────────────────────
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

    // ── No front camera ───────────────────────────────────────────────────────
    if (!faceCamera.hasFrontCamera || !device) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>
                    No front-facing camera found on this device.
                </Text>
            </SafeAreaView>
        );
    }

    // ── Initializing ──────────────────────────────────────────────────────────
    if (detectionState.isInitializing) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>Initializing camera…</Text>
            </SafeAreaView>
        );
    }

    // ── Detection error ───────────────────────────────────────────────────────
    if (detectionState.error) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.errorCode}>{detectionState.error.code}</Text>
                <Text style={styles.message}>{detectionState.error.message}</Text>
            </SafeAreaView>
        );
    }

    // ── Complete — show aligned faces ─────────────────────────────────────────
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
                <TouchableOpacity style={styles.button} onPress={reset}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ── Camera live ───────────────────────────────────────────────────────────
    const { qualityResult, positionResult, captureStatus } = enrollmentState;
    const statusColor = CAPTURE_STATUS_COLORS[captureStatus] ?? '#888';

    return (
        <View style={styles.container}>
            {/* Camera preview — fills the screen */}
            <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                outputs={[photoOutput]}
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

            {/* Overlay — status badge at the bottom */}
            <SafeAreaView style={styles.overlay} pointerEvents="none">
                <View style={[styles.badge, { borderColor: statusColor }]}>

                    {/* Capture pipeline status */}
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {CAPTURE_STATUS_LABELS[captureStatus] ?? captureStatus}
                    </Text>

                    {/* Progress */}
                    <Text style={styles.debug}>
                        Captured: {enrollmentState.capturedFrames.length} / {enrollmentState.targetFrameCount}
                    </Text>

                    {/* Stability bar */}
                    <Text style={styles.debug}>
                        Stability: {enrollmentState.stableFrameCount} / {enrollmentState.stableFrameTarget}
                    </Text>

                    {/* Quality */}
                    {qualityResult && (
                        <Text style={[
                            styles.debug,
                            { color: qualityResult.status === 'good' ? '#51CF66' : '#FFD43B' },
                        ]}>
                            Quality: {QUALITY_LABELS[qualityResult.status] ?? qualityResult.status}
                        </Text>
                    )}

                    {/* Position */}
                    {positionResult && (
                        <Text style={[
                            styles.debug,
                            { color: positionResult.status === 'centered' ? '#51CF66' : '#FFD43B' },
                        ]}>
                            Position: {POSITION_LABELS[positionResult.status] ?? positionResult.status}
                        </Text>
                    )}

                    {/* Raw face count */}
                    <Text style={styles.debug}>
                        Faces: {detectionState.faces.length}{'  '}
                        Status: {detectionState.status}
                    </Text>

                    {/* Euler angles when one face present */}
                    {detectionState.faces.length === 1 && (
                        <Text style={styles.debug}>
                            yaw={detectionState.faces[0].yawAngle?.toFixed(1)}°{'  '}
                            pitch={detectionState.faces[0].pitchAngle?.toFixed(1)}°{'  '}
                            roll={detectionState.faces[0].rollAngle?.toFixed(1)}°
                        </Text>
                    )}

                    {/* Error */}
                    {enrollmentState.error && (
                        <Text style={[styles.debug, { color: '#FF6B6B' }]}>
                            {enrollmentState.error}
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
    badge: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
        minWidth: 280,
        marginBottom: 16,
        gap: 4,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    debug: {
        fontSize: 11,
        color: '#aaa',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    completeTitle: {
        color: '#51CF66',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    completeSubtitle: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 24,
    },
    alignedRow: {
        maxHeight: 180,
        marginBottom: 32,
    },
    alignedRowContent: {
        gap: 12,
        paddingHorizontal: 8,
    },
    alignedFrame: {
        alignItems: 'center',
        gap: 4,
    },
    alignedImage: {
        width: 112,
        height: 112,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
    },
    alignedLabel: {
        color: '#888',
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});