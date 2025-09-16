import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env';

const buildServiceAccount = () => {
  const privateKey = env.firebasePrivateKey;

  if (!privateKey || privateKey.trim().length === 0) {
    throw new Error('Environment variable FIREBASE_PRIVATE_KEY cannot be empty');
  }

  if (
    !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error(
      'Environment variable FIREBASE_PRIVATE_KEY must contain a PEM formatted private key'
    );
  }

  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey,
  };
};

const createFirebaseApp = () => {
  try {
    return initializeApp({
      credential: cert(buildServiceAccount()),
    });
  } catch (err) {
    throw new Error(
      `Failed to initialize Firebase Admin SDK. Double-check FIREBASE_* env vars. ${(
        err as Error
      ).message}`
    );
  }
};

const app = getApps().length === 0 ? createFirebaseApp() : getApp();

export const firestore = getFirestore(app);

firestore.settings({ ignoreUndefinedProperties: true });
