import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { AlignedFace } from '../types';
import { EMBEDDING_CONFIG } from './embeddingConfig';

// ─── Preprocessing ────────────────────────────────────────────────────────────

/**
 * Convert an aligned face image (112×112 JPEG) into the Float32Array expected
 * by the ArcFace TFLite model.
 *
 * Layout: NCHW flat — all R values, then all G values, then all B values.
 * Total: 3 × 112 × 112 = 37 632 floats.
 *
 * Normalisation: (pixel − 127.5) / 127.5  →  range [−1, 1].
 *
 * Strategy
 * ─────────
 * expo-image-manipulator can render an image and return raw pixel bytes via
 * the 'uint8' base64 raw format (RGB, no alpha, row-major).
 * We read those bytes, apply normalisation, and reorder HWC → CHW.
 */
export async function preprocessFaceImage(face: AlignedFace): Promise<Float32Array> {
    const { INPUT_HEIGHT, INPUT_WIDTH, INPUT_CHANNELS, PIXEL_MEAN, PIXEL_STD } =
        EMBEDDING_CONFIG;

    // Ensure the image is exactly 112×112 (it should be from Phase 2, but
    // resize defensively to handle any rounding).
    const resized = await manipulateAsync(
        face.uri,
        [{ resize: { width: INPUT_WIDTH, height: INPUT_HEIGHT } }],
        { format: SaveFormat.PNG, base64: true },
    );

    if (!resized.base64) {
        throw new Error('[Preprocessing] manipulateAsync did not return base64 data.');
    }

    // Decode base64 PNG → raw bytes.
    // expo-file-system can read the file we just wrote; alternatively decode
    // the base64 string directly using atob (available in Hermes).
    const rawB64 = resized.base64;
    const binaryStr = atob(rawB64);

    // PNG binary starts with an 8-byte signature then chunks.
    // We need raw RGB pixel values. The simplest cross-platform approach:
    // write the PNG to a temp file, then use NativeModules or a pure-JS PNG
    // decoder. However, expo-image-manipulator in newer Expo SDK versions
    // supports the 'raw' SaveFormat that returns RGBA bytes directly.
    //
    // For SDK 57 we use SaveFormat.PNG with base64 and decode using
    // the react-native-nitro-image (already in package.json) pixel reader,
    // or fall back to a manual PNG IDAT decode.
    //
    // Practical approach for now: save the resized image to a temp URI and
    // use NativePixelReader from react-native-nitro-image.

    // ── Write temp file ────────────────────────────────────────────────────
    const tempUri =
        FileSystem.cacheDirectory + `face_preprocess_${Date.now()}.png`;

    await FileSystem.writeAsStringAsync(tempUri, rawB64, {
        encoding: FileSystem.EncodingType.Base64,
    });

    // ── Read raw RGBA pixels via react-native-nitro-image ─────────────────
    // NitroImage.getPixels returns a Uint8Array of RGBA values, row-major.
    const { NitroImage } = require('react-native-nitro-image') as {
        NitroImage: { getPixels(uri: string): Promise<Uint8Array> };
    };

    const rgba = await NitroImage.getPixels(tempUri);

    // Clean up the temp file (best-effort).
    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => { });

    // ── HWC(RGBA) → CHW(RGB) + normalise ──────────────────────────────────
    const pixelCount = INPUT_HEIGHT * INPUT_WIDTH; // 12 544
    const output = new Float32Array(INPUT_CHANNELS * pixelCount); // 37 632

    const rOffset = 0;
    const gOffset = pixelCount;
    const bOffset = pixelCount * 2;

    for (let i = 0; i < pixelCount; i++) {
        const base = i * 4; // RGBA stride
        output[rOffset + i] = (rgba[base] - PIXEL_MEAN) / PIXEL_STD;
        output[gOffset + i] = (rgba[base + 1] - PIXEL_MEAN) / PIXEL_STD;
        output[bOffset + i] = (rgba[base + 2] - PIXEL_MEAN) / PIXEL_STD;
        // Alpha channel ignored.
    }

    return output;
}