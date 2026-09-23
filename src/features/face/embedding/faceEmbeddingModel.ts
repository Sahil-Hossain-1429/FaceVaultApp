import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TfliteModel } from 'react-native-fast-tflite/src/specs/Tflite.nitro';
import { EMBEDDING_CONFIG } from './embeddingConfig';

// ─── Model session (singleton) ────────────────────────────────────────────────

let _model: TfliteModel | null = null;

async function resolveLocalModelUri(): Promise<string> {
    const dest = FileSystem.cacheDirectory + 'w600k_r50.tflite';
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) {
        console.log('[EmbeddingModel] Using cached model at:', dest);
        return dest;
    }
    console.log('[EmbeddingModel] Copying model asset to cache...');
    const [asset] = await Asset.loadAsync(EMBEDDING_CONFIG.MODEL_ASSET_PATH);
    if (!asset.localUri) {
        throw new Error('[EmbeddingModel] Asset.loadAsync did not return a localUri.');
    }
    await FileSystem.copyAsync({ from: asset.localUri, to: dest });
    console.log('[EmbeddingModel] Model cached at:', dest);
    return dest;
}

export async function getEmbeddingModel(): Promise<TfliteModel> {
    if (_model) return _model;

    const localUri = await resolveLocalModelUri();

    // Pass as { url } so loadTensorflowModel uses assetLoader.loadAsset(uri)
    // Our patched HybridAssetLoader.kt uses mmap for file:// URIs — no heap copy.
    console.log('[EmbeddingModel] Loading model via loadTensorflowModel({ url })...');
    _model = await loadTensorflowModel(
        { url: localUri },
        [], // empty = default CPU delegate
    );

    console.log('[EmbeddingModel] ✓ Model loaded');
    return _model;
}

export function releaseEmbeddingModel(): void {
    _model = null;
}