// Service Worker for Expiry Tracker PWA
// This file runs in the background on the user's phone
// It caches files so the app works offline

const CACHE_NAME  = "expiry-tracker-v1";
const OFFLINE_URL = "/offline.html";

// These files will be saved on the phone after first visit
const CACHE_FILES = [
    "/",
    "/index.html",
    "/offline.html",
    "/manifest.json"
];

// ── INSTALL ─────────────────────────────────────────────
// Runs once when service worker is first set up
// Saves app files to phone storage
self.addEventListener("install", (event) => {
    console.log("[SW] Installing...");
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log("[SW] Caching app files");
                return cache.addAll(CACHE_FILES);
            })
            .then(() => self.skipWaiting())
    );
});

// ── ACTIVATE ────────────────────────────────────────────
// Runs after install — deletes old cached versions
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating...");
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// ── FETCH ────────────────────────────────────────────────
// Runs on every network request
// API calls (login, items) → always go to network (live data)
// HTML/CSS/JS files → try cache first, then network
self.addEventListener("fetch", (event) => {
    // Skip non-GET requests like POST, DELETE
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // These are API calls — always fetch live, never from cache
    const isAPI = ["/add", "/items", "/delete",
                   "/dashboard", "/auth"]
                  .some((p) => url.pathname.startsWith(p));
    if (isAPI) return;

    // For all other files: try cache first, fallback to network
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // serve from cache
            }
            // Not in cache — fetch from network and save to cache
            return fetch(event.request)
                .then((networkResponse) => {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME)
                          .then((cache) => cache.put(event.request, copy));
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed and not in cache — show offline page
                    return caches.match(OFFLINE_URL);
                });
        })
    );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────
// Receive push notifications (for future expiry alerts)
self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(
            data.title || "⚠️ Expiry Alert",
            {
                body:    data.body || "Some items are expiring soon!",
                icon:    "/icons/icon-192.png",
                badge:   "/icons/icon-192.png",
                vibrate: [200, 100, 200]
            }
        )
    );
});

// When user taps a notification — open the app
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow("/"));
});