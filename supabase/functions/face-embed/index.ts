import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';

// ─── CORS headers ────────────────────────────────────────────────────────────

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Preprocessing ────────────────────────────────────────────────────────────

/**
 * Convert a base64-encoded JPEG into a Float32Array in NCHW layout.
 * Normalization: (pixel - 127.5) / 127.5
 */
async function preprocessBase64Image(base64: string): Promise<Float32Array> {
    // Decode base64 → raw bytes
    const binaryString = atob(base64);
    const jpegBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        jpegBytes[i] = binaryString.charCodeAt(i);
    }

    // Decode JPEG using Deno's built-in ImageData via createImageBitmap
    const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
    const imageBitmap = await createImageBitmap(blob);

    // Draw to OffscreenCanvas to get RGBA pixels
    const canvas = new OffscreenCanvas(112, 112);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageBitmap, 0, 0, 112, 112);
    const imageData = ctx.getImageData(0, 0, 112, 112);
    const rgba = imageData.data; // Uint8ClampedArray, RGBA interleaved

    // Build NCHW Float32Array: [1, 3, 112, 112]
    const pixelCount = 112 * 112;
    const tensor = new Float32Array(3 * pixelCount);
    const mean = 127.5;
    const std = 127.5;

    for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * 4;
        tensor[i]                  = (rgba[srcIdx]     - mean) / std; // R
        tensor[i + pixelCount]     = (rgba[srcIdx + 1] - mean) / std; // G
        tensor[i + pixelCount * 2] = (rgba[srcIdx + 2] - mean) / std; // B
    }

    return tensor;
}

// ─── L2 normalization ─────────────────────────────────────────────────────────

function l2Normalize(values: number[]): { normalized: number[]; norm: number } {
    let sumSq = 0;
    for (const v of values) sumSq += v * v;
    const norm = Math.sqrt(sumSq);
    if (norm < 1e-10) throw new Error('Embedding norm too close to zero');
    return {
        normalized: values.map(v => v / norm),
        norm,
    };
}

// ─── Model loading ────────────────────────────────────────────────────────────

let session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
    if (session) return session;

    // The model is stored in Supabase Storage and fetched at cold start.
    // We read the URL from an environment variable set in the dashboard.
    const modelUrl = Deno.env.get('ARCFACE_MODEL_URL');
    if (!modelUrl) {
        throw new Error(
            'ARCFACE_MODEL_URL environment variable is not set. ' +
            'Upload w600k_r50.onnx to Supabase Storage and set this variable.',
        );
    }

    const response = await fetch(modelUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
    }

    const modelBuffer = await response.arrayBuffer();
    session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
    });

    return session;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { images } = await req.json() as { images: string[] };

        if (!Array.isArray(images) || images.length === 0) {
            return new Response(
                JSON.stringify({ error: 'images must be a non-empty array of base64 strings' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
        }

        // Load model (cached after first call)
        const sess = await getSession();
        const inputName = sess.inputNames[0];
        const outputName = sess.outputNames[0];

        const embeddings: number[][] = [];

        for (let i = 0; i < images.length; i++) {
            // Preprocess
            const tensorData = await preprocessBase64Image(images[i]);

            // Run inference
            const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, 112, 112]);
            const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
            const results = await sess.run(feeds);
            const output = results[outputName];

            // Extract values
            const raw = Array.from(output.data as Float32Array);

            // L2 normalize
            const { normalized } = l2Normalize(raw);
            embeddings.push(normalized);
        }

        // Aggregate: mean of normalized embeddings → re-normalize
        const dimension = embeddings[0].length;
        const mean = new Array<number>(dimension).fill(0);
        for (const emb of embeddings) {
            for (let i = 0; i < dimension; i++) mean[i] += emb[i];
        }
        for (let i = 0; i < dimension; i++) mean[i] /= embeddings.length;

        const { normalized: template, norm } = l2Normalize(mean);

        return new Response(
            JSON.stringify({
                embeddings,
                template,
                dimension,
                norm,
                framesProcessed: embeddings.length,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );

    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[face-embed] Error:', message);
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
});