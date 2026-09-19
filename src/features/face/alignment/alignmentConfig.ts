// ─── Alignment Configuration ─────────────────────────────────────────────────
//
// Documents the geometry used in face alignment so that the numbers
// are never magic values buried inside calculation code.

export const ALIGNMENT_CONFIG = {
    /**
     * Output image dimensions in pixels (square).
     *
     * 112×112 is the standard ArcFace input size.
     * Using it now means the Phase 3 embedding model receives
     * correctly-sized inputs without any further resizing.
     */
    OUTPUT_SIZE: 112,

    /**
     * The desired eye positions in the OUTPUT image, expressed as
     * fractions of OUTPUT_SIZE.
     *
     * These match the canonical ArcFace reference alignment:
     *   left eye  → (0.3125, 0.375) → pixel (35, 42) in a 112×112 image
     *   right eye → (0.6875, 0.375) → pixel (77, 42) in a 112×112 image
     *
     * "Left" and "Right" here are from the SUBJECT's perspective,
     * which in a front-camera capture (mirrored preview) means:
     *   subject's left eye  appears on the RIGHT side of the image
     *   subject's right eye appears on the LEFT side of the image
     *
     * ML Kit landmark names follow the SUBJECT's anatomy:
     *   LEFT_EYE  = subject's left eye
     *   RIGHT_EYE = subject's right eye
     *
     * After mirroring correction (see alignment module) the subject's
     * left eye will be on the left side of the saved photo.
     * These reference positions assume a correctly-oriented (non-mirrored)
     * saved photo.
     */
    REFERENCE_LEFT_EYE_X_RATIO: 0.3125,  // 35 / 112
    REFERENCE_LEFT_EYE_Y_RATIO: 0.375,   // 42 / 112
    REFERENCE_RIGHT_EYE_X_RATIO: 0.6875,  // 77 / 112
    REFERENCE_RIGHT_EYE_Y_RATIO: 0.375,   // 42 / 112

    /**
     * The crop region is a square centred on the eye midpoint,
     * whose side length equals this multiplier × the inter-eye distance.
     *
     * 2.8 gives comfortable margin above the forehead and below the chin
     * for a typical frontal face, matching common ArcFace preprocessing.
     */
    CROP_SCALE_FACTOR: 2.8,

    /**
     * JPEG quality for saved aligned images (0–100).
     * 90 balances file size against fidelity for a recognition pipeline.
     */
    JPEG_QUALITY: 90,
} as const;