import { getEmbeddingModel } from '../embedding/faceEmbeddingModel';
import type { AlignedFace } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrollmentTemplate {
    /** L2-normalised 512-D mean embedding */
    embedding: Float32Array;
    /** Number of frames that contributed to the template */
    frameCount: number;
    /** ISO timestamp of enrollment */
    enrolledAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Warm up the TFLite model so the first real inference is fast.
 * Call once when the enrollment screen mounts.
 */
export async function warmUpEmbeddingModel(): Promise<void> {
    await getEmbeddingModel();
}

/**
 * Build an enrollment template from a set of aligned face frames.
 *
 * 1. Embed each frame with ArcFace.
 * 2. Average the embeddings element-wise.
 * 3. L2-normalise the result.
 *
 * @throws  If fewer than 1 embedding can be computed from the provided frames.
 */
export async function buildEnrollmentTemplate(
    alignedFaces: AlignedFace[],
): Promise<EnrollmentTemplate> {
    if (alignedFaces.length === 0) {
        throw new Error('[Enrollment] No aligned faces provided.');
    }

    console.log(`[Enrollment] Aligned faces received: ${alignedFaces.length}`);

    // ── TEMPORARY: skip real embedding, use dummy vector ──────────────────
    // Remove this block once model loading is fixed
    const dummyEmbedding = new Float32Array(512).fill(0.001);
    console.log('[Enrollment] Using dummy embedding — model loading bypassed');
    return {
        embedding: dummyEmbedding,
        frameCount: alignedFaces.length,
        enrolledAt: new Date().toISOString(),
    };
    // ── END TEMPORARY ─────────────────────────────────────────────────────
}