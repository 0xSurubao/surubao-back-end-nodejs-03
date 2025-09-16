import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env';

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: env.firebaseProjectId,
          clientEmail: env.firebaseClientEmail,
          privateKey: env.firebasePrivateKey,
        }),
      })
    : getApp();

export const firestore = getFirestore(app);

firestore.settings({ ignoreUndefinedProperties: true });
