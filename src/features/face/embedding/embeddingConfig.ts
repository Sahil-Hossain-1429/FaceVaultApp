// ─── Embedding Configuration ─────────────────────────────────────────────────

export const EMBEDDING_CONFIG = {
    /**
     * Path to the TFLite model asset.
     * metro.config.js must include 'tflite' in resolver.assetExts.
     */
    MODEL_ASSET_PATH: require('../../../../assets/models/w600k_r50_float32.tflite'),

    /**
     * Expected input dimensions for the ArcFace w600k_r50 model.
     * Shape: [1, 3, 112, 112] — NCHW, float32.
     *
     * react-native-fast-tflite feeds tensors as flat Float32Arrays.
     * Total elements: 1 × 3 × 112 × 112 = 37 632.
     */
    INPUT_HEIGHT: 112,
    INPUT_WIDTH: 112,
    INPUT_CHANNELS: 3,

    /**
     * Pixel normalisation: (value − 127.5) / 127.5  →  range [−1, 1].
     */
    PIXEL_MEAN: 127.5,
    PIXEL_STD: 127.5,

    /**
     * Output: [1, 512] float32 — raw embedding before L2 normalisation.
     */
    EMBEDDING_DIM: 512,
} as const;