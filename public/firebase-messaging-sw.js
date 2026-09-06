/* Firebase Cloud Messaging background handler for SINURMAN. */
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCmmuxsbDh_xsBQ6E5EGxt6UYRY8-NOP1Q",
  authDomain: "sinurman-2026.firebaseapp.com",
  projectId: "sinurman-2026",
  storageBucket: "sinurman-2026.firebasestorage.app",
  messagingSenderId: "673013542498",
  appId: "1:673013542498:web:47d8ed1502a0aaeee8ab3b",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "SINURMAN";
  const options = {
    body: payload.notification?.body || "Ada pembaruan baru di aplikasi SINURMAN.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: payload.data || { url: "/" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const openWindow = windows.find((window) => "focus" in window);
    if (openWindow) {
      openWindow.navigate(target);
      return openWindow.focus();
    }
    return clients.openWindow(target);
  }));
});
