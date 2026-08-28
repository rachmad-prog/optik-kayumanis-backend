// Menyimpan gambar secara lokal di folder /uploads (lihat src/middleware/upload.js).
// URL publik dibentuk dari PUBLIC_API_URL (kalau diisi di .env) atau otomatis
// dari protokol+host request yang masuk (works out of the box di VPS, asalkan
// tidak di belakang reverse proxy yang menyembunyikan host asli).

function buildPublicUrl(req, filename) {
  const base = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  return `${base}/uploads/${filename}`;
}

async function uploadFiles(req, res) {
  const files = req.files || [];

  if (!files.length) {
    return res.status(400).json({ message: "Tidak ada file yang diunggah." });
  }

  try {
    const urls = files.map((file) => buildPublicUrl(req, file.filename));
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
