"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

function firebaseConfig() {
  return {
    apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function firebaseClient() {
  const config=firebaseConfig();
  if(!config.apiKey||!config.projectId||!config.appId) {
    throw new Error("Konfigurasi Firebase Web belum lengkap.");
  }
  const app=getApps().length?getApp():initializeApp(config);
  return {app,auth:getAuth(app)};
}

export async function firebaseMessagingToken() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "";
  if (!(await isSupported())) return "";
  const { app } = firebaseClient();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "";
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging: Messaging = getMessaging(app);
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  return getToken(messaging, { serviceWorkerRegistration: registration, ...(vapidKey ? { vapidKey } : {}) });
}
