// Upload gambar ke Cloudflare R2 (S3-compatible). File masuk sebagai buffer
// di memori lewat multer (lihat src/middleware/upload.js), lalu di-PUT ke
// bucket R2. URL publik dibentuk dari R2_PUBLIC_URL (custom domain atau
// default *.r2.dev — lihat src/config/r2.js).
const crypto = require("crypto");
const path = require("path");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
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

  if (!R2_BUCKET_NAME) {
    return res.status(500).json({
      message:
        "Konfigurasi R2 belum lengkap. Pastikan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_BUCKET_NAME sudah diisi di .env.",
    });
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const fallbackBaseUrl = `${protocol}://${host}/api/uploads/file`;

    const baseUrl = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/+$/, "") : fallbackBaseUrl;

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
        return `${baseUrl}/${key}`;
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

async function getFileProxy(req, res) {
  const key = req.params[0] || req.params.key;

  if (!key) {
    return res.status(400).json({ message: "Key file tidak valid." });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    const response = await r2.send(command);

    if (response.ContentType) {
      res.setHeader("Content-Type", response.ContentType);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const bytes = await response.Body.transformToByteArray();
    return res.send(Buffer.from(bytes));
  } catch (error) {
    console.error("Proxy R2 File Error:", error);
    return res.status(404).json({ message: "File tidak ditemukan." });
  }
}

module.exports = { uploadFiles, getFileProxy };
