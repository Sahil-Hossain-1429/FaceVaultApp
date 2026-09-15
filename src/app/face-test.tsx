import {
    generateEmbedding,
    loadFaceEmbeddingModel,
} from '@/services/faceEmbedding'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera'
import { Camera, type Face } from 'react-native-vision-camera-face-detector'

export default function FaceTestScreen() {
    const { hasPermission, requestPermission } = useCameraPermission()
    const device = useCameraDevice('front')
    const [modelStatus, setModelStatus] = useState('Loading model...')
    const [embeddingStatus, setEmbeddingStatus] = useState('')
    const cameraRef = useRef<any>(null)
    const isProcessing = useRef(false)

    useEffect(() => {
        if (!hasPermission) requestPermission()
    }, [hasPermission])

    useEffect(() => {
        loadFaceEmbeddingModel()
            .then(() => setModelStatus('Model ready ✓'))
            .catch((e) => setModelStatus(`Model error: ${e.message}`))
    }, [])

    async function handleFacesDetected(faces: Face[]) {
        if (faces.length === 0) return
        if (isProcessing.current) return
        if (!cameraRef.current) return

        isProcessing.current = true

        try {
            const face = faces[0]
            const { x, y, width, height } = face.bounds

            setEmbeddingStatus('Capturing frame...')

            const photo = await cameraRef.current.takeSnapshot({
                quality: 100,
                skipMetadata: true,
            })

            console.log('[FaceTest] Image size:', photo.width, 'x', photo.height)
            console.log('[FaceTest] Face bounds:', x, y, width, height)

            setEmbeddingStatus('Cropping face...')

            // Clamp crop to image boundaries
            const imgW = photo.width
            const imgH = photo.height

            const cropX = Math.max(0, Math.round(x))
            const cropY = Math.max(0, Math.round(y))
            const cropEndX = Math.min(Math.round(x + width), imgW)
            const cropEndY = Math.min(Math.round(y + height), imgH)

            if (cropEndX <= cropX || cropEndY <= cropY) {
                console.log('[FaceTest] Invalid crop bounds, skipping')
                isProcessing.current = false
                return
            }

            console.log('[FaceTest] Crop coords:', cropX, cropY, cropEndX, cropEndY)

            const cropped = await photo.cropAsync(cropX, cropY, cropEndX, cropEndY)
            const resized = await cropped.resizeAsync(112, 112)


            setEmbeddingStatus('Extracting pixels...')

            const rawPixels = await resized.toRawPixelDataAsync()

            console.log('[FaceTest] Pixel format:', rawPixels.pixelFormat)
            console.log('[FaceTest] Buffer:', rawPixels.buffer)

            // buffer is an ArrayBuffer — convert to Uint8Array
            const pixelArray = new Uint8Array(rawPixels.buffer)

            console.log('[FaceTest] Pixel array size:', pixelArray.length)

            setEmbeddingStatus('Running ArcFace inference...')

            // Convert RGBA → RGB
            const rgbPixels = rawPixels.pixelFormat === 'RGBA'
                ? rgba2rgb(pixelArray, 112, 112)
                : pixelArray

            const embedding = await generateEmbedding(rgbPixels, 112, 112)

            console.log('[FaceTest] Embedding generated!')
            console.log('[FaceTest] Embedding size:', embedding.length)
            console.log('[FaceTest] First 8 values:', Array.from(embedding.slice(0, 8)))
            console.log('[FaceTest] Magnitude (should be ~1.0):', computeMagnitude(embedding))

            setEmbeddingStatus(`✓ Embedding: ${embedding.length}D vector`)

        } catch (e: any) {
            console.error('[FaceTest] Embedding error:', e.message)
            setEmbeddingStatus(`Error: ${e.message}`)
        } finally {
            setTimeout(() => { isProcessing.current = false }, 3000)
        }
    }

    if (!hasPermission) {
        return (
            <View style={styles.center}>
                <Text style={styles.text}>Requesting camera permission…</Text>
            </View>
        )
    }

    if (!device) {
        return (
            <View style={styles.center}>
                <Text style={styles.text}>No front camera found</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                onFacesDetected={handleFacesDetected}
                runLandmarks
                performanceMode="fast"
            />
            <View style={styles.overlay}>
                <Text style={styles.overlayText}>{modelStatus}</Text>
                {embeddingStatus ? (
                    <Text style={styles.overlaySubText}>{embeddingStatus}</Text>
                ) : null}
            </View>
        </View>
    )
}

function computeMagnitude(v: Float32Array): number {
    let sum = 0
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
    return Math.sqrt(sum)
}

function rgba2rgb(rgba: Uint8Array, width: number, height: number): Uint8Array {
    const pixels = width * height
    const rgb = new Uint8Array(pixels * 3)
    for (let i = 0; i < pixels; i++) {
        rgb[i * 3 + 0] = rgba[i * 4 + 0]
        rgb[i * 3 + 1] = rgba[i * 4 + 1]
        rgb[i * 3 + 2] = rgba[i * 4 + 2]
    }
    return rgb
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#010617' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#010617' },
    text: { color: '#F3F6F9', fontSize: 14 },
    overlay: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        padding: 20,
    },
    overlayText: { color: '#5FAEF7', fontSize: 18, fontWeight: '700' },
    overlaySubText: { color: '#8698B4', fontSize: 13, marginTop: 8, textAlign: 'center' },
})