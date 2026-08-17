import { Directory, File, Paths } from 'expo-file-system';

const vaultRoot = new Directory(Paths.document, 'vault');

export function ensureVaultDir() {
    if (!vaultRoot.exists) {
        vaultRoot.create({ intermediates: true });
    }

    const nomedia = new File(vaultRoot, '.nomedia');
    if (!nomedia.exists) {
        nomedia.create();
    }
}

export function getFolder(folderId: string) {
    return new Directory(vaultRoot, folderId);
}

export function createFolder(folderId: string) {
    const dir = getFolder(folderId);

    if (!dir.exists) {
        dir.create({ intermediates: true });
    }
    return dir;
}

// Copies a picked file
export function importFile(sourceUri: string, folderId: string, fileName: string) {
    const destDir = createFolder(folderId);
    const sourceFile = new File(sourceUri);
    const desFile = new File(destDir, fileName);
    sourceFile.copy(desFile);
    return desFile;
}

export function listFolder(folderId: string){
    const dir = getFolder(folderId);
    if(!dir.exists) return [];
    return dir.list();
}

export function deleteFile(file: File){
    file.delete();
}

export function renameFile(file: File, newName: string){
    file.rename(newName);
    return file;
}

export function moveFile(file: File, targetFolderId: string){
    const destDir = createFolder(targetFolderId);
    file.move(destDir);
    return file;
}