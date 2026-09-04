import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

//  Todo SecureStore key. Swap this value with real encryption key  
const VAULT_TOKEN_KEY = 'vault_unlock_token';

export type BiometricCapability = {
    hasHardware: boolean;
    isEnrolled: boolean;

    canUseBiometrics: boolean;
    supportedTypes: LocalAuthentication.AuthenticationType[];
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
        hasHardware,
        isEnrolled,
        canUseBiometrics: hasHardware && isEnrolled,
        supportedTypes,
    };
}

export type BiometricAuthOutcome =
    | { status: 'success' }
    | { status: 'failed'; reason: LocalAuthentication.LocalAuthenticationError }
    | { status: 'unavailable' };

export async function promptBiometricUnlock(
    promptMessage = 'Unlock Your Vault',
    disableDeviceFallback = true
): Promise<BiometricAuthOutcome> {
    const capability = await getBiometricCapability();

    if (!capability.canUseBiometrics) {
        return { status: 'unavailable' };
    }


    const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback,
        cancelLabel: 'Cancel',
    });

    if (result.success) {
        return { status: 'success' };
    }

    return { status: 'failed', reason: result.error };
}

export async function provisionVaultToken(value: string = 'unlocked'): Promise<void> {
    await SecureStore.setItemAsync(VAULT_TOKEN_KEY, value);
}

export async function getVaultToken(): Promise<string | null> {
    return SecureStore.getItemAsync(VAULT_TOKEN_KEY);
}

export async function hasVaultToken(): Promise<boolean> {
    const token = await getVaultToken();
    return token != null;
}

export async function clearVaultToken(): Promise<void> {
    await SecureStore.deleteItemAsync(VAULT_TOKEN_KEY);
}