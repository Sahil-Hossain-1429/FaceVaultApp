import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { NitroModules } from 'react-native-nitro-modules';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { EMBEDDING_CONFIG } from './embeddingConfig';

// ─── Model session (singleton) ────────────────────────────────────────────────

let _model: TensorflowModel | null = null;

async function resolveLocalModelUri(): Promise<string> {
    const dest = FileSystem.cacheDirectory + 'w600k_r50.tflite';

    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists) {
        console.log('[EmbeddingModel] Using cached model at:', dest);
        return dest;
    }

    console.log('[EmbeddingModel] Downloading model asset to cache...');
    const [asset] = await Asset.loadAsync(EMBEDDING_CONFIG.MODEL_ASSET_PATH);

    if (!asset.localUri) {
        throw new Error('[EmbeddingModel] Asset.loadAsync did not return a localUri.');
    }

    await FileSystem.copyAsync({ from: asset.localUri, to: dest });
    console.log('[EmbeddingModel] Model cached at:', dest);
    return dest;
}

export async function getEmbeddingModel(): Promise<TensorflowModel> {
    if (_model) return _model;

    const localUri = await resolveLocalModelUri();

    const tfliteModule = NitroModules.createHybridObject<{
        createModel(data: ArrayBuffer, delegates?: string): TensorflowModel;
        createModelFromFile(path: string): TensorflowModel;
    }>('TfliteModule');

    if (typeof (tfliteModule as any).createModelFromFile === 'function') {
        console.log('[EmbeddingModel] Loading model from file path (mmap)');
        _model = (tfliteModule as any).createModelFromFile(localUri.replace('file://', ''));
    } else {
        console.log('[EmbeddingModel] Loading model via ArrayBuffer from file');
        const assetLoader = NitroModules.createHybridObject<{
            loadAsset(uri: string): Promise<ArrayBuffer>;
        }>('AssetLoader');
        const data = await assetLoader.loadAsset(localUri);
        _model = tfliteModule.createModel(data);
    }

    console.log('[EmbeddingModel] ✓ Model loaded');
    return _model!;
}

export function releaseEmbeddingModel(): void {
    _model = null;
}