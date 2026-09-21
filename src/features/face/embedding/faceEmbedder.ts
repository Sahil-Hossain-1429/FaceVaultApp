import type { AlignedFace } from '../types';
import { EMBEDDING_CONFIG } from './embeddingConfig';
import { getEmbeddingModel } from './faceEmbeddingModel';
import { preprocessFaceImage } from './facePreprocessing';
import { l2Normalize } from './normalizeEmbedding';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a single L2-normalised 512-D embedding for one aligned face image.
 *
 * @param face  AlignedFace from Phase 2 (112×112 JPEG, local URI).
 * @returns     Float32Array of length 512, unit norm.
 */
export async function embedFace(face: AlignedFace): Promise<Float32Array> {
    const model = await getEmbeddingModel();
    const input = await preprocessFaceImage(face);

    // react-native-fast-tflite: run(inputs) accepts an array of typed arrays,
    // one per input tensor. Returns an array of typed arrays, one per output.
    const outputs = await model.run([input]);

    if (!outputs || outputs.length === 0) {
        throw new Error('[Embedder] Model returned no outputs.');
    }

    // Output tensor: [1, 512] flat → length 512 Float32Array.
    const raw = outputs[0] as Float32Array;

    if (raw.length !== EMBEDDING_CONFIG.EMBEDDING_DIM) {
        throw new Error(
            `[Embedder] Unexpected output length: ${raw.length} (expected ${EMBEDDING_CONFIG.EMBEDDING_DIM}).`,
        );
    }

    return l2Normalize(new Float32Array(raw));
}

/**
 * Embed all aligned faces, skipping any that fail.
 *
 * @returns Array of L2-normalised embeddings (may be shorter than `faces` if
 *          some frames fail preprocessing or inference).
 */
export async function embedAllFaces(faces: AlignedFace[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const face of faces) {
        try {
            console.log(`[Embedder] Embedding face ${face.id}`);
            const emb = await embedFace(face);
            console.log(`[Embedder] ✓ ${face.id} — norm: ${
                Math.sqrt(emb.reduce((s, v) => s + v * v, 0)).toFixed(6)
            }`);
            results.push(emb);
        } catch (e) {
            console.warn('[Embedder] Skipping face due to error:', e);
        }
    }
    return results;
}