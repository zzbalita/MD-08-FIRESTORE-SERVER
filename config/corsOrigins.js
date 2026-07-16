const staticOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://192.168.1.7:8080",
  "https://md-08-firestore-admin.vercel.app",
];

/** Extra origins from Railway/env: CORS_ORIGINS=https://store.vercel.app,https://admin.vercel.app */
function envOrigins() {
  const raw = process.env.CORS_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = [...staticOrigins, ...envOrigins()];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Local Flutter web on LAN
  if (/^http:\/\/192\.168\.\d+\.\d+:8080$/.test(origin)) return true;
  // Vercel preview / production URLs for store or admin
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
}

module.exports = { allowedOrigins, isAllowedOrigin };
