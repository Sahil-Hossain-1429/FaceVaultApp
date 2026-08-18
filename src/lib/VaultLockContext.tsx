import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
    clearVaultToken,
    getBiometricCapability,
    hasVaultToken,
    promptBiometricUnlock,
    provisionVaultToken,
    type BiometricAuthOutcome,
    type BiometricCapability,
} from './vaultLock';

export type AutoLockTimeout = 'immediately' | '1min' | '5min' | '15min';

const AUTO_LOCK_MS: Record<AutoLockTimeout, number> = {
    immediately: 0,
    '1min': 60_000,
    '5min': 5 * 60_000,
    '15min': 15 * 60_000,
};

type VaultLockContextValue = {
    hasCompletedSetup: boolean;
    isUnlocked: boolean;
    isInitializing: boolean;
    autoLockTimeout: AutoLockTimeout;

    setAutoLockTimeout: (timeout: AutoLockTimeout) => void;
    checkBiometricCapability: () => Promise<BiometricCapability>;
    unlockWithBiometrics: () => Promise<BiometricAuthOutcome>;
    unlockWithToken: () => Promise<void>;
    completeSecuritySetup: () => Promise<void>;
    resetVaultSecurity: () => Promise<void>;
    lock: () => void;
};

const VaultLockContext = createContext<VaultLockContextValue | undefined>(undefined);

export function VaultLockProvider({ children }: { children: ReactNode }) {
    const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [autoLockTimeout, setAutoLockTimeout] = useState<AutoLockTimeout>('5min');

    const backgroundedAtRef = useRef<number | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        let isMounted = true;
        (async () => {
            const exists = await hasVaultToken();
            if (isMounted) {
                setHasCompletedSetup(exists);
                setIsInitializing(false);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const prevState = appStateRef.current;

            const isGoingToBackground =
                prevState === 'active' && (nextState === 'background' || nextState === 'inactive');
            const isReturningToForeground = prevState !== 'active' && nextState === 'active';

            if (isGoingToBackground) {
                backgroundedAtRef.current = Date.now();
            }

            if (isReturningToForeground && backgroundedAtRef.current !== null) {
                const elapsed = Date.now() - backgroundedAtRef.current;
                const threshold = AUTO_LOCK_MS[autoLockTimeout];

                if (elapsed >= threshold) {
                    setIsUnlocked(false);
                }
                backgroundedAtRef.current = null;
            }

            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, [autoLockTimeout]);

    const checkBiometricCapability = useCallback(() => getBiometricCapability(), []);

    const unlockWithBiometrics = useCallback(async (): Promise<BiometricAuthOutcome> => {
        const outcome = await promptBiometricUnlock();
        if (outcome.status === 'success') {
            setIsUnlocked(true);
        }
        return outcome;
    }, []);

    const unlockWithToken = useCallback(async () => {
        setIsUnlocked(true);
    }, []);

    const completeSecuritySetup = useCallback(async () => {
        await provisionVaultToken();
        setHasCompletedSetup(true);
        setIsUnlocked(true);
    }, []);

    const resetVaultSecurity = useCallback(async () => {
        await clearVaultToken();
        setHasCompletedSetup(false);
        setIsUnlocked(false);
    }, []);

    const lock = useCallback(() => {
        setIsUnlocked(false);
    }, []);

    const value = useMemo<VaultLockContextValue>(
        () => ({
            hasCompletedSetup,
            isUnlocked,
            isInitializing,
            autoLockTimeout,
            setAutoLockTimeout,
            checkBiometricCapability,
            unlockWithBiometrics,
            unlockWithToken,
            completeSecuritySetup,
            resetVaultSecurity,
            lock,
        }),
        [
            hasCompletedSetup,
            isUnlocked,
            isInitializing,
            autoLockTimeout,
            checkBiometricCapability,
            unlockWithBiometrics,
            unlockWithToken,
            completeSecuritySetup,
            resetVaultSecurity,
            lock,
        ]
    );

    return <VaultLockContext.Provider value={value}>{children}</VaultLockContext.Provider>;
}

export function useVaultLock(): VaultLockContextValue {
    const ctx = useContext(VaultLockContext);
    if (!ctx) {
        throw new Error('useVaultLock must be used within a VaultLockProvider');
    }
    return ctx;
}