import { Asset } from 'expo-asset'
import { InferenceSession, Tensor } from 'onnxruntime-react-native'

const MODEL_ASSET = require('@/assets/models/arcface_w600k_r50.onnx')
const INPUT_SIZE = 112        // ArcFace expects 112x112
const EMBEDDING_SIZE = 512    // ArcFace R50 output size


let session: InferenceSession | null = null

export async function loadFaceEmbeddingModel(): Promise<void> {
    if (session) return

    try {
        console.log('[FaceEmbedding] Loading ArcFace R50 model...')

        const [asset] = await Asset.loadAsync(MODEL_ASSET)

        if (!asset.localUri) {
            throw new Error('Model asset localUri is null after loading')
        }

        session = await InferenceSession.create(asset.localUri, {
            executionProviders: ['cpu'],
        })

        console.log('[FaceEmbedding] Model loaded successfully')
        console.log('[FaceEmbedding] Input names:', session.inputNames)
        console.log('[FaceEmbedding] Output names:', session.outputNames)
    } catch (error) {
        session = null
        console.error('[FaceEmbedding] Failed to load model:', error)
        throw error
    }
}

export function isModelLoaded(): boolean {
    return session !== null
}

/**
 * Converts raw RGB pixel data (Uint8Array, HWC layout) to a
 * normalized Float32Array in CHW layout, range [-1, 1].
 *
 * ArcFace expects: NCHW, float32, mean=0.5, std=0.5
 * i.e. pixel = (value / 255 - 0.5) / 0.5 = value / 127.5 - 1
 */
export function preprocessFaceCrop(
    pixelData: Uint8Array,    // Raw RGB pixels, HWC, 112x112x3
    width: number,            // Must be 112
    height: number,           // Must be 112
): Float32Array {
    if (width !== INPUT_SIZE || height !== INPUT_SIZE) {
        throw new Error(
            `Expected ${INPUT_SIZE}x${INPUT_SIZE} crop, got ${width}x${height}`
        )
    }

    const channelSize = INPUT_SIZE * INPUT_SIZE
    const tensor = new Float32Array(3 * channelSize)

    for (let i = 0; i < channelSize; i++) {
        const r = pixelData[i * 3 + 0]
        const g = pixelData[i * 3 + 1]
        const b = pixelData[i * 3 + 2]

        tensor[0 * channelSize + i] = r / 127.5 - 1.0  // R
        tensor[1 * channelSize + i] = g / 127.5 - 1.0  // G
        tensor[2 * channelSize + i] = b / 127.5 - 1.0  // B
    }

    return tensor
}

/**
 * Runs ArcFace inference on a preprocessed face crop.
 * Returns a 512-dimension L2-normalized embedding vector.
 */
export async function generateEmbedding(
    pixelData: Uint8Array,
    width: number,
    height: number,
): Promise<Float32Array> {
    if (!session) {
        throw new Error('Model not loaded. Call loadFaceEmbeddingModel() first.')
    }

    // Preprocess to CHW float32
    const preprocessed = preprocessFaceCrop(pixelData, width, height)

    // Build ONNX tensor: shape [1, 3, 112, 112]
    const inputTensor = new Tensor('float32', preprocessed, [1, 3, INPUT_SIZE, INPUT_SIZE])

    // Run inference — input name is typically 'input.1' for ArcFace R50
    const inputName = session.inputNames[0]
    const feeds: Record<string, Tensor> = { [inputName]: inputTensor }

    const results = await session.run(feeds)

    // Get output — typically '516' or 'output' for ArcFace R50
    const outputName = session.outputNames[0]
    const outputTensor = results[outputName]
    const rawEmbedding = outputTensor.data as Float32Array

    
    return l2Normalize(rawEmbedding)
}

/**
 * Cosine similarity between two L2-normalized embeddings.
 * Returns a value in [-1, 1]. Typical match threshold: >= 0.35
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        throw new Error(`Embedding size mismatch: ${a.length} vs ${b.length}`)
    }

    let dot = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
    }

    // Since both are L2 normalized, magnitudes are 1 and dot product = cosine similarity
    return dot
}

/**
 * Decides if two embeddings belong to the same person.
 * Threshold of 0.35 is a conservative starting point — tune empirically.
 */
export function isSamePerson(
    a: Float32Array,
    b: Float32Array,
    threshold = 0.35,
): boolean {
    return cosineSimilarity(a, b) >= threshold
}

function l2Normalize(vector: Float32Array): Float32Array {
    let magnitude = 0
    for (let i = 0; i < vector.length; i++) {
        magnitude += vector[i] * vector[i]
    }
    magnitude = Math.sqrt(magnitude)

    if (magnitude === 0) return vector

    const normalized = new Float32Array(vector.length)
    for (let i = 0; i < vector.length; i++) {
        normalized[i] = vector[i] / magnitude
    }
    return normalized
}