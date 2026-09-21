// ─── L2 Normalisation ────────────────────────────────────────────────────────

/**
 * L2-normalise a raw embedding vector in-place and return it.
 *
 * ArcFace outputs a raw 512-D vector. Cosine similarity comparisons require
 * unit vectors; L2 normalisation makes ‖v‖ = 1 so that dot-product == cosine.
 *
 * @param embedding  Raw Float32Array of length 512 (modified in place).
 * @returns          The same array after normalisation.
 * @throws           If the vector is all-zeros (degenerate embedding).
 */
export function l2Normalize(embedding: Float32Array): Float32Array {
    let sumSq = 0;
    for (let i = 0; i < embedding.length; i++) {
        sumSq += embedding[i] * embedding[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm < 1e-10) {
        throw new Error('[Normalize] Embedding has near-zero norm — degenerate output from model.');
    }

    for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
    }

    return embedding;
}

/**
 * Average a set of embeddings element-wise, then L2-normalise.
 *
 * Used to produce an enrollment template from multiple per-frame embeddings.
 * All embeddings must have the same length.
 */
export function averageAndNormalize(embeddings: Float32Array[]): Float32Array {
    if (embeddings.length === 0) {
        throw new Error('[Normalize] Cannot average an empty embedding list.');
    }

    const dim = embeddings[0].length;
    const avg = new Float32Array(dim);

    for (const emb of embeddings) {
        if (emb.length !== dim) {
            throw new Error(`[Normalize] Embedding dimension mismatch: expected ${dim}, got ${emb.length}.`);
        }
        for (let i = 0; i < dim; i++) {
            avg[i] += emb[i];
        }
    }

    const count = embeddings.length;
    for (let i = 0; i < dim; i++) {
        avg[i] /= count;
    }

    return l2Normalize(avg);
}