const crypto = require("crypto");
const path = require("path");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { r2, R2_BUCKET_NAME, R2_PUBLIC_URL } = require("../config/r2");

const UPLOAD_PREFIX = "dapoer_toeti_uploads"; // nama "folder" (key prefix) di bucket R2

function buildObjectKey(originalName) {
  const ext = path.extname(originalName || "").toLowerCase() || ".jpg";
  const uniqueId = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return `${UPLOAD_PREFIX}/${uniqueId}${ext}`;
}

async function uploadFiles(req, res) {
  const files = req.files || [];

  if (!files.length) {
    return res.status(400).json({ message: "Tidak ada file yang diunggah." });
  }

  if (!R2_PUBLIC_URL) {
    console.error(
      "[uploads] R2_PUBLIC_URL belum diset. Set env ini ke URL publik bucket R2 kamu " +
        "(mis. https://pub-xxxxxxxx.r2.dev atau custom domain)."
    );
  }

  try {
    const uploadToR2 = async (file) => {
      const key = buildObjectKey(file.originalname);

      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      return `${R2_PUBLIC_URL}/${key}`;
    };

    const urls = await Promise.all(files.map(uploadToR2));

    res.status(201).json({ urls });
  } catch (error) {
    console.error("R2 Upload Error:", error);
    res.status(500).json({
      message: "Gagal mengunggah ke Cloudflare R2",
      error: error.message,
    });
  }
}

module.exports = { uploadFiles };
