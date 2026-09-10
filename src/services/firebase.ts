/**
 * Firebase Firestore Service Initialization
 * 
 * Required Firestore Security Rules:
 * match /visitor_logs/{docId} {
 *   allow create, read: if true;
 *   allow update, delete: if false;
 * }
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const getEnv = (nextKey: string, viteKey: string, fallback: string): string => {
  if (typeof process !== 'undefined' && process.env?.[nextKey]) {
    return process.env[nextKey] as string;
  }
  try {
    // Check import.meta.env if available in Vite environments
    if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.[viteKey]) {
      return (import.meta as unknown as { env: Record<string, string> }).env[viteKey];
    }
  } catch {
    // Ignore error if import.meta is not evaluated
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnv(
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'VITE_FIREBASE_API_KEY',
    'AIzaSyAt_31NmzYnCXwppmMzWYDkLJKj_RDs83A'
  ),
  authDomain: getEnv(
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'cakrapala-6eee6.firebaseapp.com'
  ),
  projectId: getEnv(
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_PROJECT_ID',
    'cakrapala-6eee6'
  ),
  storageBucket: getEnv(
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'cakrapala-6eee6.firebasestorage.app'
  ),
  messagingSenderId: getEnv(
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    '767292055295'
  ),
  appId: getEnv(
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'VITE_FIREBASE_APP_ID',
    '1:767292055295:web:63667359d204353f9976ca'
  ),
  measurementId: getEnv(
    'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'VITE_FIREBASE_MEASUREMENT_ID',
    'G-3L7EGDXYL6'
  ),
};

// Initialize Firebase safely (avoid re-initialization in SSR / HMR)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
