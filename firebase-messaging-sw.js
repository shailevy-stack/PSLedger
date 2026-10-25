// Show every push ourselves, before the Firebase SDK's own handler sees it:
// exactly one notification per push, even with the app open (iOS revokes push
// for pushes that show nothing), tagged per section so e.g. a Board update can't
// silently replace an unread Shopping notification.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}
  const n = payload.notification || {};
  const title = n.title || "PS Central";
  const body  = n.body  || "Something changed";
  event.stopImmediatePropagation();
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "apple-touch-icon.png",
    badge: "apple-touch-icon.png",
    tag: "ps-" + title.toLowerCase().replace(/\s+/g, "-"),
    renotify: true,
  }));
});

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
