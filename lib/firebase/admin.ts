import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;

export function getAdminApp(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        process.env.FIREBASE_STORAGE_BUCKET ||
        `${projectId}.firebasestorage.app` ||
        `${projectId}.appspot.com`;

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: bucketName,
      });
      return adminApp;
    } catch (e) {
      console.warn('Failed to initialize Firebase Admin SDK with credentials:', e);
    }
  }

  return null;
}

let adminDbInstance: Firestore | null = null;

export function getAdminDb(): Firestore | null {
  if (adminDbInstance) return adminDbInstance;
  const app = getAdminApp();
  if (!app) return null;
  adminDbInstance = getFirestore(app);
  adminDbInstance.settings({ ignoreUndefinedProperties: true });
  return adminDbInstance;
}

export function getAdminStorage(): Storage | null {
  const app = getAdminApp();
  return app ? getStorage(app) : null;
}
