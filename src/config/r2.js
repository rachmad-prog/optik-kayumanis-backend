const { S3Client } = require("@aws-sdk/client-s3");

// Cloudflare R2 punya API yang kompatibel dengan S3, jadi kita pakai AWS SDK
// biasa tapi arahkan endpoint-nya ke R2.
// Endpoint R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

// URL publik dasar untuk mengakses file yang sudah diupload.
// - Kalau kamu sudah setup custom domain di R2, isi R2_PUBLIC_URL dengan itu
//   (mis. "https://cdn.tokokamu.com").
// - Kalau belum, pakai default r2.dev yang formatnya:
//   https://pub-<HASH>.r2.dev  (didapat dari Dashboard R2 > bucket > Settings > Public Access)
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

module.exports = { r2, R2_BUCKET_NAME, R2_PUBLIC_URL };
