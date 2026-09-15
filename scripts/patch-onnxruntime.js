const fs = require('fs')
const path = require('path')

const filePath = path.join(
    __dirname,
    '../node_modules/onnxruntime-react-native/android/build.gradle'
)

if (!fs.existsSync(filePath)) {
    console.log('[patch-onnxruntime] File not found, skipping.')
    process.exit(0)
}

let content = fs.readFileSync(filePath, 'utf8')

const oldBlock = `  if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {
    extractLibs "com.facebook.fbjni:fbjni:+:headers"
    extractLibs "com.facebook.fbjni:fbjni:+"
  }`

const newBlock = `  // patched: RN >= 0.71 always true, fbjni not needed`

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock)
    fs.writeFileSync(filePath, content, 'utf8')
    console.log('[patch-onnxruntime] Successfully patched VersionNumber block.')
} else {
    console.log('[patch-onnxruntime] Already patched or pattern not found.')
}

// Check for actual VersionNumber API calls, not comments
if (content.includes('VersionNumber.parse(')) {
    console.log('[patch-onnxruntime] WARNING: VersionNumber.parse() still present.')
} else {
    console.log('[patch-onnxruntime] Clean — no VersionNumber.parse() calls remain.')
}