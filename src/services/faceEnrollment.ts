/**
 * faceEnrollment.ts  —  SFace edition
 *
 * Model: face_recognition_sface_2021dec.onnx  (OpenCV Zoo, Apache-2.0)
 * Source: https://huggingface.co/opencv/face_recognition_sface
 *
 * Pipeline:
 *   Camera snapshot → crop & resize (expo-image-manipulator)
 *   → RGBA pixel buffer (react-native-nitro-image)
 *   → Float32 NCHW tensor, BGR channel order, raw 0-255 values  ← SFace specific
 *   → ONNX inference  (input: "data",  output: "fc1",  128-D embedding)
 *   → L2-normalise → AES-256-GCM encrypt → expo-secure-store
 *
 * Key differences from the previous ArcFace R50 version:
 *   • Model file  : sface_2021dec.onnx          (37 MB vs 174 MB)
 *   • Input name  : "data"                       (was "input")
 *   • Output name : "fc1"                        (was "output")
 *   • Normalization: raw pixel 0-255 BGR         (was (px/127.5)-1 RGB)
 *   • Channel order: BGR                         (was RGB)
 *   • Embedding dim: 128-D                       (was 512-D)
 *   • Cosine match threshold: 0.363              (official from sface.py)
 *   • License     : Apache-2.0, shippable ✅     (was research-only ❌)
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import type { InferenceSession, Tensor } from 'onnxruntime-react-native';
import type { RefObject } from 'react';
import { NitroImage } from 'react-native-nitro-image';
import type { Face } from 'react-native-vision-camera-face-detector';

// ─── Constants ────────────────────────────────────────────────────────────────

/** SFace model — bundled in app assets, copied to cache on first use. */
const MODEL_ASSET_PATH = 'assets/models/face_recognition_sface_2021dec.onnx';

/** SecureStore keys for the encrypted embedding blob (split into 2 chunks). */
const EMBEDDING_STORE_KEY = 'face_vault_sface_embedding_v1';
const EMBEDDING_STORE_KEY_2 = 'face_vault_sface_embedding_v1_2';

/** SecureStore key for the AES-256 encryption key (base64). */
const ENC_KEY_STORE_KEY = 'face_vault_sface_enc_key_v1';

/** SFace input resolution — always 112×112. */
const MODEL_INPUT_SIZE = 112;

/**
 * SFace ONNX tensor names (confirmed from OpenCV Zoo source + OpenVINO docs).
 *   Input  → "data"  shape [1, 3, 112, 112]  BGR, raw 0-255
 *   Output → "fc1"   shape [1, 128]           raw (L2-normalise after)
 */
const MODEL_INPUT_NAME = 'data';
const MODEL_OUTPUT_NAME = 'fc1';

/** SFace embedding dimensions. */
const EMBEDDING_DIM = 128;

/**
 * Official cosine similarity threshold from OpenCV Zoo sface.py.
 * Faces with similarity >= 0.363 are considered the same person.
 * Exported so faceRecognition.ts can import it directly.
 */
export const SFACE_COSINE_THRESHOLD = 0.363;

/**
 * Padding added around the raw ML Kit bounding box before cropping.
 * 25% gives enough forehead and chin for SFace alignment.
 */
const BBOX_PADDING = 0.25;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrollmentResult {
    /** Cosine self-check — should be ~1.0 on a clean enrollment. */
    selfSimilarity: number;
}

// ─── Module-level ONNX session cache ─────────────────────────────────────────

let _session: InferenceSession | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main enrollment entry-point.
 * Called from FaceRecognitionSetup.tsx once liveness (blink) is confirmed.
 *
 * @param cameraRef  Ref to the active <Camera> component.
 * @param face       Best face from the liveness-confirmed frame.
 */
export async function enrollFace(
    cameraRef: RefObject<Camera>,
    face: Face,
): Promise<EnrollmentResult> {
    const photoPath = await capturePhoto(cameraRef);

    try {
        const croppedUri = await cropAndResize(photoPath, face);
        const tensor = await imageToTensor(croppedUri);
        const rawEmbedding = await runInference(tensor);
        const embedding = l2Normalise(rawEmbedding);

        await persistEmbedding(embedding);

        const selfSim = cosineSimilarity(embedding, embedding);
        console.log('[enrollFace] self-similarity:', selfSim);
        return { selfSimilarity: selfSim };
    } finally {
        await FileSystem.deleteAsync(photoPath, { idempotent: true }).catch(() => { });
    }
}

/** Returns true if an embedding is already enrolled on this device. */
export async function isEnrolled(): Promise<boolean> {
    const blob = await SecureStore.getItemAsync(EMBEDDING_STORE_KEY);
    return blob !== null;
}

/** Wipes the stored embedding and encryption key — call before re-enrollment. */
export async function clearEnrollment(): Promise<void> {
    await SecureStore.deleteItemAsync(EMBEDDING_STORE_KEY);
    await SecureStore.deleteItemAsync(EMBEDDING_STORE_KEY_2);
    await SecureStore.deleteItemAsync(ENC_KEY_STORE_KEY);
    _session = null; // reset model cache so it reloads if needed
    console.log('[enrollFace] enrollment cleared');
}

// ─── Step 1 — Capture ────────────────────────────────────────────────────────

async function capturePhoto(cameraRef: RefObject<Camera>): Promise<string> {
    if (!cameraRef.current) throw new Error('[enrollFace] Camera ref is null.');

    const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
    });

    const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
    console.log('[enrollFace] snapshot →', uri);
    return uri;
}

// ─── Step 2 — Crop & resize ──────────────────────────────────────────────────

/**
 * Crops the padded face bounding box from the full photo and resizes to 112×112.
 *
 * expo-image-manipulator v57 crop syntax:
 *   { crop: { originX, originY, width, height } }
 */
async function cropAndResize(photoUri: string, face: Face): Promise<string> {
    const { x, y, width, height } = face.bounds;

    const padX = width * BBOX_PADDING;
    const padY = height * BBOX_PADDING;

    const originX = Math.max(0, x - padX);
    const originY = Math.max(0, y - padY);
    const cropWidth = width + padX * 2;
    const cropHeight = height + padY * 2;

    const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [
            {
                crop: {
                    originX: Math.round(originX),
                    originY: Math.round(originY),
                    width: Math.round(cropWidth),
                    height: Math.round(cropHeight),
                },
            },
            {
                resize: {
                    width: MODEL_INPUT_SIZE,
                    height: MODEL_INPUT_SIZE,
                },
            },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
    );

    console.log('[enrollFace] cropped →', result.uri, result.width, '×', result.height);
    return result.uri;
}

// ─── Step 3 — Image → Float32 tensor ─────────────────────────────────────────

/**
 * Converts the 112×112 JPEG to a Float32Array shaped [1, 3, 112, 112] (NCHW).
 *
 * SFace normalization (from OpenCV Zoo + OpenVINO docs):
 *   • Channel order: BGR  (NitroImage gives RGBA — discard A, swap R↔B)
 *   • Values: raw 0–255 float32  (NO /127.5 - 1, that's ArcFace)
 *
 * NitroImage.toRawPixelDataAsync returns:
 *   { buffer: ArrayBuffer, width: number, height: number, pixelFormat: 'RGBA' }
 */
async function imageToTensor(imageUri: string): Promise<Tensor> {
    const { buffer, width, height } = await NitroImage.toRawPixelDataAsync(imageUri);

    if (width !== MODEL_INPUT_SIZE || height !== MODEL_INPUT_SIZE) {
        throw new Error(
            `[enrollFace] Unexpected size ${width}×${height}; expected ${MODEL_INPUT_SIZE}×${MODEL_INPUT_SIZE}`,
        );
    }

    const rgba = new Uint8Array(buffer);
    const pixelCount = width * height;                // 12544
    const float32 = new Float32Array(3 * pixelCount); // [C, H, W] flattened

    /**
     * NCHW layout — SFace expects BGR channel order:
     *   Channel 0 = B  (rgba[i*4 + 2])
     *   Channel 1 = G  (rgba[i*4 + 1])
     *   Channel 2 = R  (rgba[i*4 + 0])
     * Values are raw 0–255 float32.
     */
    for (let i = 0; i < pixelCount; i++) {
        const r = rgba[i * 4];
        const g = rgba[i * 4 + 1];
        const b = rgba[i * 4 + 2];
        // Channel 0 = B
        float32[i] = b;
        // Channel 1 = G
        float32[pixelCount + i] = g;
        // Channel 2 = R
        float32[2 * pixelCount + i] = r;
    }

    return new Tensor('float32', float32, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
}

// ─── Step 4 — ONNX inference ──────────────────────────────────────────────────

async function runInference(inputTensor: Tensor): Promise<Float32Array> {
    const session = await getSession();

    const feeds: Record<string, Tensor> = { [MODEL_INPUT_NAME]: inputTensor };
    const results = await session.run(feeds);

    const outputTensor = results[MODEL_OUTPUT_NAME];
    if (!outputTensor) {
        throw new Error(`[enrollFace] ONNX output tensor '${MODEL_OUTPUT_NAME}' missing.`);
    }

    const data = outputTensor.data as Float32Array;
    if (data.length !== EMBEDDING_DIM) {
        throw new Error(
            `[enrollFace] Expected ${EMBEDDING_DIM}-D embedding, got ${data.length}.`
        );
    }

    console.log('[enrollFace] inference OK, embedding dim:', data.length);
    return data;
}

/**
 * Returns the cached InferenceSession, creating it on first call.
 * The model is copied from app assets to FileSystem.cacheDirectory on first use.
 */
async function getSession(): Promise<InferenceSession> {
    if (_session) return _session;

    // Import ONLY when needed, not at module load time
    const { InferenceSession } = await import('onnxruntime-react-native');

    const modelUri = await resolveModelUri();
    console.log('[enrollFace] loading ONNX session →', modelUri);

    _session = await InferenceSession.create(modelUri, {
        executionProviders: ['cpu'],
    });

    console.log('[enrollFace] ONNX session ready');
    return _session;
}

/**
 * Copies the bundled SFace ONNX model to the cache directory on first use.
 * Uses expo-asset to resolve the Metro-bundled require() to a local file URI.
 */
async function resolveModelUri(): Promise<string> {
    const destPath = `${FileSystem.cacheDirectory}face_recognition_sface_2021dec.onnx`;

    const fileInfo = await FileSystem.getInfoAsync(destPath);
    if (fileInfo.exists) {
        console.log('[enrollFace] model already in cache');
        return destPath;
    }

    console.log('[enrollFace] copying model to cache…');
    const { Asset } = await import('expo-asset');
    // require() path must be a static literal string for Metro bundling.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asset = Asset.fromModule(require('@/assets/models/face_recognition_sface_2021dec.onnx'));
    await asset.downloadAsync();

    if (!asset.localUri) {
        throw new Error('[enrollFace] Failed to resolve local URI for SFace model.');
    }

    await FileSystem.copyAsync({ from: asset.localUri, to: destPath });
    console.log('[enrollFace] model copied →', destPath);
    return destPath;
}

// ─── Step 5 — L2 normalise ───────────────────────────────────────────────────

/**
 * L2-normalises the 128-D embedding so every vector lies on the unit sphere.
 * Cosine similarity then reduces to a plain dot product.
 */
function l2Normalise(embedding: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
    norm = Math.sqrt(norm);

    if (norm === 0) throw new Error('[enrollFace] Zero-magnitude embedding — inference failed.');

    const out = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) out[i] = embedding[i] / norm;
    return out;
}

// ─── Step 6 — Encrypt & persist ──────────────────────────────────────────────

/**
 * Encrypts the 128-D Float32 embedding with AES-256-GCM and stores it in
 * expo-secure-store (Android Keystore-backed).
 *
 * 128-D Float32 = 512 bytes raw → ~700 bytes base64 after encryption.
 * Well under the expo-secure-store ~2 KB per-key limit, so no chunking needed.
 * We keep chunk 2 for API compatibility with faceRecognition.ts but it may
 * be empty (null) — loadStoredEmbedding handles both cases.
 */
async function persistEmbedding(embedding: Float32Array): Promise<void> {
    const keyBase64 = await getOrCreateEncKey();
    const keyBytes = base64ToBytes(keyBase64);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
    );

    const plaintext = new Uint8Array(embedding.buffer);
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        plaintext,
    );

    // Layout: | 12 bytes IV | ciphertext+16-byte auth-tag |
    const cipherBytes = new Uint8Array(cipherBuffer);
    const blob = new Uint8Array(iv.length + cipherBytes.length);
    blob.set(iv, 0);
    blob.set(cipherBytes, iv.length);

    const blobBase64 = bytesToBase64(blob);

    // 128-D SFace is small enough to fit in a single SecureStore entry (<2KB).
    // Store everything in the primary key; clear chunk 2 if it exists from
    // a previous ArcFace enrollment.
    await SecureStore.setItemAsync(EMBEDDING_STORE_KEY, blobBase64);
    await SecureStore.deleteItemAsync(EMBEDDING_STORE_KEY_2).catch(() => { });

    console.log(`[enrollFace] embedding stored (${blobBase64.length} base64 chars)`);
}

async function getOrCreateEncKey(): Promise<string> {
    const existing = await SecureStore.getItemAsync(ENC_KEY_STORE_KEY);
    if (existing) return existing;

    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    const keyBase64 = bytesToBase64(keyBytes);
    await SecureStore.setItemAsync(ENC_KEY_STORE_KEY, keyBase64);
    console.log('[enrollFace] new AES-256 key generated');
    return keyBase64;
}

// ─── Exported helpers (used by faceRecognition.ts) ────────────────────────────

/**
 * Decrypts and returns the stored 128-D embedding.
 * Returns null if nothing is enrolled yet.
 */
export async function loadStoredEmbedding(): Promise<Float32Array | null> {
    // Support both single-chunk (SFace) and two-chunk (legacy ArcFace) storage.
    const chunk1 = await SecureStore.getItemAsync(EMBEDDING_STORE_KEY);
    if (!chunk1) return null;

    const chunk2 = await SecureStore.getItemAsync(EMBEDDING_STORE_KEY_2).catch(() => null);
    const blobBase64 = chunk2 ? chunk1 + chunk2 : chunk1;
    const blob = base64ToBytes(blobBase64);

    const iv = blob.slice(0, 12);
    const cipherBytes = blob.slice(12);

    const keyBase64 = await SecureStore.getItemAsync(ENC_KEY_STORE_KEY);
    if (!keyBase64) throw new Error('[loadStoredEmbedding] Encryption key missing.');

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        base64ToBytes(keyBase64),
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
    );

    const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        cipherBytes,
    );

    return new Float32Array(plainBuffer);
}

/**
 * Cosine similarity between two L2-normalised embeddings.
 * Returns a value in [-1, 1].  Match threshold: SFACE_COSINE_THRESHOLD (0.363).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) throw new Error('[cosineSimilarity] Dimension mismatch.');
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}