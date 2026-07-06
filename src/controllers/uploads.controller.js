const { v2 as cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// Pastikan konfigurasi ini ada (atau ambil dari file config global Anda)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadFiles(req, res) {
  const files = req.files || [];
  
  if (!files.length) {
    return res.status(400).json({ message: "Tidak ada file yang diunggah." });
  }

  try {
    // Fungsi untuk mengunggah satu file ke Cloudinary
    const uploadToCloudinary = (file) => {
      return new Promise((resolve, reject) => {
        const cld_upload_stream = cloudinary.uploader.upload_stream(
          { folder: "dapoer_toeti_uploads" }, 
          (error, result) => {
            if (result) resolve(result.secure_url);
            else reject(error);
          }
        );
        streamifier.createReadStream(file.buffer).pipe(cld_upload_stream);
      });
    };

    // Jalankan unggahan untuk semua file yang dikirim
    const uploadPromises = files.map((file) => uploadToCloudinary(file));
    const urls = await Promise.all(uploadPromises);

    res.status(201).json({ urls });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ message: "Gagal mengunggah ke Cloudinary", error: error.message });
  }
}

module.exports = { uploadFiles };