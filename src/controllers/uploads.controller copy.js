// Generic file upload — used by any admin feature that needs an image URL
// (hero slides, etc). Product images have their own /api/products/upload
// route for historical reasons, but both share this same handler.
async function uploadFiles(req, res) {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: "Tidak ada file yang diunggah." });
  }
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
  const urls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);
  res.status(201).json({ urls });
}

module.exports = { uploadFiles };
