/* eslint-disable no-undef */

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyCr_rWHnm0w79J63dm69DEMkjawulE5Ovk",
    authDomain: "bitlance-761eb.firebaseapp.com",
    projectId: "bitlance-761eb",
    storageBucket: "bitlance-761eb.firebasestorage.app",
    messagingSenderId: "482009206673",
    appId: "1:482009206673:web:dc57ce72ee5ed5b050d430",
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || "Bitlance";

    self.registration.showNotification(title, {
      body: notification.body || data.body || "You have a new update.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag || data.url || title,
      data: {
        url: data.url || "/",
      },
    });
  });
} catch (error) {
  console.error("Firebase messaging service worker failed to initialize:", error);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return client;
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    })
  );
});
