import { useCallback, useEffect, useState } from 'react';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CameraPermissionStatus =
    | 'undetermined'
    | 'granted'
    | 'denied';

export interface FaceCameraState {
    permissionStatus: CameraPermissionStatus;
    hasFrontCamera: boolean;
    /** True only when permission is granted AND a front camera exists */
    isReady: boolean;
    /** Call this to show the OS permission dialog */
    requestPermission: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFaceCamera(): FaceCameraState {
    const device = useCameraDevice('front');

    // VisionCamera v5 exposes permissions only via this hook.
    // hasPermission is a boolean: true = granted, false = not granted.
    // requestPermission() shows the OS dialog and returns Promise<boolean>.
    const { hasPermission, requestPermission: vcRequestPermission } =
        useCameraPermission();

    // We track three states:
    //   'undetermined' — user has not been asked yet (initial)
    //   'granted'      — user approved
    //   'denied'       — user explicitly refused via the OS dialog
    // VisionCamera v5 doesn't distinguish undetermined vs denied via the hook,
    // so we track 'denied' ourselves after requestPermission() returns false.
    const [permissionStatus, setPermissionStatus] =
        useState<CameraPermissionStatus>(
            hasPermission ? 'granted' : 'undetermined',
        );

    // If the user grants permission in device Settings and returns to the app,
    // hasPermission will flip to true. Sync our local state when that happens.
    useEffect(() => {
        if (hasPermission && permissionStatus !== 'granted') {
            setPermissionStatus('granted');
        }
    }, [hasPermission, permissionStatus]);

    const requestPermission = useCallback(async () => {
        const granted = await vcRequestPermission();
        setPermissionStatus(granted ? 'granted' : 'denied');
    }, [vcRequestPermission]);

    return {
        permissionStatus,
        hasFrontCamera: device != null,
        isReady: permissionStatus === 'granted' && device != null,
        requestPermission,
    };
}