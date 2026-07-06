const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Files are stored on local disk under backend/uploads and served statically
// from /uploads (see src/index.js). Good enough for a single-server setup;
// swap the storage engine here first if this ever needs to move to S3/Cloudinary.
const uploadDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Hanya file gambar yang diperbolehkan."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5MB per file, max 10 files
});

module.exports = upload;
