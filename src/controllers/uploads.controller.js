// Upload gambar ke Cloudflare R2 (S3-compatible). File masuk sebagai buffer
// di memori lewat multer (lihat src/middleware/upload.js), lalu di-PUT ke
// bucket R2. URL publik dibentuk dari R2_PUBLIC_URL (custom domain atau
// default *.r2.dev — lihat src/config/r2.js).
const crypto = require("crypto");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } = require("../config/r2");

function buildObjectKey(originalname) {
  const ext = path.extname(originalname || "").toLowerCase() || ".jpg";
  const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return `products/${uniqueId}${ext}`;
}

async function uploadFiles(req, res) {
  const files = req.files || [];

  if (!files.length) {
    return res.status(400).json({ message: "Tidak ada file yang diunggah." });
  }

  if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return res.status(500).json({
      message:
        "Konfigurasi R2 belum lengkap. Pastikan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, dan R2_PUBLIC_URL sudah diisi di .env.",
    });
  }

  try {
    const urls = await Promise.all(
      files.map(async (file) => {
        const key = buildObjectKey(file.originalname);
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        return `${R2_PUBLIC_URL}/${key}`;
      }),
    );

    res.status(201).json({ urls });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({
      message: "Gagal mengunggah gambar.",
      error: error.message,
    });
  }
}

module.exports = { uploadFiles };
