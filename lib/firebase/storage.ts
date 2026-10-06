import fs from 'fs';
import path from 'path';
import { getAdminStorage } from './admin';
import { LOCAL_STORAGE_DIR } from './service';

export async function uploadContractFile(
  storagePath: string,
  buffer: Buffer,
  contentType = 'application/pdf'
): Promise<string> {
  const adminStorage = getAdminStorage();
  if (adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(storagePath);
      await file.save(buffer, {
        metadata: { contentType },
      });
      return storagePath;
    } catch (e) {
      console.warn("Cloud Storage save failed; falling back to resilient local storage:", e);
    }
  }

  // Local storage fallback
  const fullPath = path.join(LOCAL_STORAGE_DIR, storagePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, buffer);
  return storagePath;
}

export async function getContractFileBuffer(storagePath: string): Promise<Buffer | null> {
  const adminStorage = getAdminStorage();
  if (adminStorage) {
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(storagePath);
      const [downloadedBuffer] = await file.download();
      return downloadedBuffer;
    } catch {
      // If not in cloud bucket, check local storage
    }
  }

  const fullPath = path.join(LOCAL_STORAGE_DIR, storagePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}
