const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Simpan file di folder lokal /uploads (di root backend). Di VPS, folder ini
// persisten selama tidak dihapus manual — beda dengan hosting serverless
// (mis. Vercel) yang filesystem-nya sementara/reset tiap deploy.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    cb(null, `${uniqueId}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Hanya file gambar yang diperbolehkan."));
  }
  cb(null, true);
}

// 2. Sekarang upload tidak lagi membutuhkan fs.mkdirSync atau path
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

module.exports = upload;
