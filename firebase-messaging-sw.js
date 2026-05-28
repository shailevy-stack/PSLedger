importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBKOfdxSQhtdM2OL2BD1C-uQpkHNg_--jg",
  authDomain: "psledger-a72d0.firebaseapp.com",
  projectId: "psledger-a72d0",
  storageBucket: "psledger-a72d0.firebasestorage.app",
  messagingSenderId: "537720501290",
  appId: "1:537720501290:web:9ce36249159f92b506bf53"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = (payload.notification && payload.notification.title) || "PS Central";
  const body  = (payload.notification && payload.notification.body)  || "Something changed";
  self.registration.showNotification(title, {
    body,
    icon: "apple-touch-icon.png",
    badge: "apple-touch-icon.png",
    tag: "ps-central",
    renotify: true,
  });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes("PSLedger") && "focus" in c) return c.focus();
      }
      return clients.openWindow(self.location.origin + "/PSLedger/");
    })
  );
});
