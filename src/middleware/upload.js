const multer = require("multer");

// 1. Ganti diskStorage menjadi memoryStorage agar file tidak ditulis ke disk
const storage = multer.memoryStorage();

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
