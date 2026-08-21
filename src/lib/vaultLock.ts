import {
    BiometricStrength,
    createKeys,
    isSensorAvailable,
    simplePrompt,
    verifyKeySignature,
} from '@sbaiahmed1/react-native-biometrics';
import * as SecureStore from 'expo-secure-store';

//  Todo SecureStore key. Swap this value with real encryption key  
const VAULT_TOKEN_KEY = 'vault_unlock_token';
const DEVICE_ID_KEY = 'vault_device_id';

// Todo: replace with real Clerk user id once auth is wired
const STUB_USER_ID = 'stub_user';

export type BiometricCapability = {
    hasHardware: boolean;
    isEnrolled: boolean;

    canUseBiometrics: boolean;
    biometryType?: string; // 'FaceID' | 'TouchID' | 'Fingerprint' | 'Biometrics'
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
    const sensorInfo = await isSensorAvailable();

    return {
        hasHardware: sensorInfo.available,
        isEnrolled: sensorInfo.available,
        canUseBiometrics: sensorInfo.available,
        biometryType: sensorInfo.biometryType,
    };
}


// ------------------- Device Identity ---------------------------

async function getOrCreateDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const newId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    return newId;
}

async function getKeyAlias(): Promise<string> {
    const deviceId = await getOrCreateDeviceId();

    return `${STUB_USER_ID}_${deviceId}`;
}

// ---------- Key provisioning (call once, during Security Setup) ----------
export type ProvisionKeyResult =
    | { status: 'created'; publicKey: string; keyAlias: string }
    | { status: 'error'; message: string }
    | { status: 'unavailable' };

export async function ensureVaultKeys(): Promise<ProvisionKeyResult> {
    const capability = await getBiometricCapability();
    if (!capability.canUseBiometrics) {
        return { status: 'unavailable' };
    }

    try {
        const keyAlias = await getKeyAlias();
        const { publicKey } = await createKeys(
            keyAlias,
            'ec256',
            BiometricStrength.Strong
        );

        // TODO: wire to Supabase
        // await supabase.from('user_biometric_keys').upsert({
        //   user_id: STUB_USER_ID,
        //   device_id: await getOrCreateDeviceId(),
        //   key_alias: keyAlias,
        //   public_key: publicKey,
        // });

        return { status: 'created', publicKey, keyAlias };
    } catch (err) {
        return { status: 'error', message: String(err) };
    }
}

// ---------- Supabase stub (nonce fetch + signature verify) ----------
async function fetchNonceStub(): Promise<string> {
    // TODO: wire to Supabase — replace with a real Edge Function call
    // that issues a short-lived, single-use nonce server-side.
    return `local_nonce_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function verifySignatureRemoteStub(
    _nonce: string,
    _signature: string,
    _keyAlias: string,
): Promise<boolean> {
    // TODO: wire to Supabase — POST { nonce, signature, keyAlias } to an
    // Edge Function that looks up the stored public_key for this
    // (user_id, device_id) and verifies with crypto.subtle.verify.
    //
    // Throwing here (instead of returning false) is what triggers the
    // local-fallback path below — simulate that a real network call
    // would throw on no connectivity.
    throw new Error('Supabase verification not yet wired');
}

// ---------- Unlock flow ----------------
export type BiometricAuthOutcome =
    | { status: 'success'; verifiedBy: 'server' | 'local' }
    | { status: 'failed'; reason?: string }
    | { status: 'unavailable' };

export async function promptBiometricUnlock(
    promptMessage = 'Unlock Your Vault'
): Promise<BiometricAuthOutcome> {
    const capability = await getBiometricCapability();

    if (!capability.canUseBiometrics) {
        return { status: 'unavailable' };
    }

    const keyAlias = await getKeyAlias();

    // --- Attempt 1: crypto-bound, server-verified path ---
    try {
        const nonce = await fetchNonceStub();

        const signResult = await verifyKeySignature(keyAlias, nonce, promptMessage);

        if (!signResult.success) {
            // Biometric itself failed/cancelled — don't fall back, this is a real "no"
            return { status: 'failed', reason: signResult.error };
        }

        const verified = await verifySignatureRemoteStub(
            nonce,
            signResult.signature ?? '',
            keyAlias
        );

        if (verified) {
            return { status: 'success', verifiedBy: 'server' };
        }

        return { status: 'failed', reason: 'Server rejected signature' };
    } catch {
        // Network/Supabase unreachable — fall back to local-only verification
    }

    // --- Attempt 2: local-only fallback (no network) ---
    const localSuccess = await simplePrompt(promptMessage);

    if (localSuccess) {
        return { status: 'success', verifiedBy: 'local' };
    }

    return { status: 'failed', reason: 'Local biometric authentication failed' };
}


// ---------- Vault session token (unchanged) ----------

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