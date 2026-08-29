const multer = require("multer");

// File disimpan sementara di memori (buffer), lalu diupload langsung ke
// Cloudflare R2 dari controller (lihat src/controllers/uploads.controller.js
// & src/config/r2.js). Tidak menulis apapun ke disk, jadi aman dipakai di
// lingkungan manapun (lokal, VPS, maupun serverless seperti Vercel).
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Hanya file gambar yang diperbolehkan."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

module.exports = upload;
