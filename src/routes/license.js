const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { requireAuth } = require("../middleware/auth");
const restrictTo = require("../middleware/restrictTo");
const {
  generatePlainToken,
  hashToken,
  TOKEN_VALIDITY_MINUTES,
} = require("../utils/licenseToken");

// Ambil (atau buat kalau belum ada sama sekali) satu-satunya baris License di DB.
async function getOrCreateLicense() {
  let license = await prisma.license.findFirst();
  if (!license) {
    license = await prisma.license.create({
      data: {
        isActive: false,
        expiredAt: new Date(0), // sudah lewat, alias belum pernah diaktifkan
        tokenUsed: true,
      },
    });
  }
  return license;
}

// GET /api/license/status
// Dipakai frontend admin (ADMIN & DIREKTUR) untuk menampilkan banner peringatan
// TANPA memblokir akses mereka ke fitur admin lainnya.
router.get("/status", requireAuth, restrictTo("ADMIN", "DIREKTUR"), async (req, res) => {
  try {
    const license = await getOrCreateLicense();
    const isExpired = new Date() > new Date(license.expiredAt);
    return res.json({
      success: true,
      isActive: license.isActive && !isExpired,
      isExpired,
      expiredAt: license.expiredAt,
    });
  } catch (error) {
    console.error("Error cek status lisensi:", error);
    return res.status(500).json({ success: false, message: "Gagal memeriksa status lisensi." });
  }
});

// POST /api/license/generate-token
// Hanya DIREKTUR. Menggenerate token acak baru (otomatis, tidak perlu edit .env sama sekali),
// menyimpan HASH-nya ke database, lalu mengembalikan token asli (plaintext) SEKALI SAJA
// untuk ditempel Direktur ke form aktivasi. Token ini hanya berlaku sebentar (lihat TOKEN_VALIDITY_MINUTES)
// dan hanya bisa dipakai satu kali.
router.post("/generate-token", requireAuth, restrictTo("DIREKTUR"), async (req, res) => {
  try {
    const license = await getOrCreateLicense();

    const plainToken = generatePlainToken();
    const hashed = hashToken(plainToken);

    await prisma.license.update({
      where: { id: license.id },
      data: {
        tokenCode: hashed,
        tokenGeneratedAt: new Date(),
        tokenUsed: false,
      },
    });

    return res.json({
      success: true,
      token: plainToken,
      validForMinutes: TOKEN_VALIDITY_MINUTES,
      message: `Token baru berhasil dibuat. Berlaku ${TOKEN_VALIDITY_MINUTES} menit dan hanya bisa dipakai sekali.`,
    });
  } catch (error) {
    console.error("Error generate token lisensi:", error);
    return res.status(500).json({ success: false, message: "Gagal membuat token baru." });
  }
});

// POST /api/license/activate
// Hanya DIREKTUR. Memverifikasi token yang barusan digenerate (via /generate-token),
// lalu memperbarui masa aktif website sesuai tanggal/jam yang dipilih di form.
// Setelah dipakai, token otomatis tidak berlaku lagi (harus generate baru untuk update berikutnya).
router.post("/activate", requireAuth, restrictTo("DIREKTUR"), async (req, res) => {
  const { inputToken, customExpiredAt } = req.body;

  try {
    if (!inputToken || !customExpiredAt) {
      return res.status(400).json({
        success: false,
        message: "Token dan batas waktu lisensi tidak boleh kosong.",
      });
    }

    const targetExpired = new Date(customExpiredAt);
    if (isNaN(targetExpired.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Format pilihan tanggal/waktu tidak valid.",
      });
    }

    const license = await getOrCreateLicense();

    if (!license.tokenCode || license.tokenUsed) {
      return res.status(400).json({
        success: false,
        message: "Belum ada token aktif. Klik \"Generate Token\" dulu untuk membuat token baru.",
      });
    }

    const tokenAgeMinutes =
      (Date.now() - new Date(license.tokenGeneratedAt).getTime()) / 60000;
    if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES) {
      return res.status(400).json({
        success: false,
        message: "Token sudah kedaluwarsa. Klik \"Generate Token\" untuk membuat yang baru.",
      });
    }

    if (hashToken(inputToken.trim()) !== license.tokenCode) {
      return res.status(400).json({
        success: false,
        message: "Token yang Anda masukkan salah / tidak valid.",
      });
    }

    // Token cocok -> update masa aktif, dan langsung "bakar" token ini supaya tidak bisa dipakai ulang.
    await prisma.license.update({
      where: { id: license.id },
      data: {
        isActive: true,
        expiredAt: targetExpired,
        tokenUsed: true,
      },
    });

    const waktuLokalFormat = targetExpired.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return res.json({
      success: true,
      message: `Aktivasi berhasil! Website diatur aktif sampai: ${waktuLokalFormat} WIB.`,
    });
  } catch (error) {
    console.error("Error aktivasi lisensi:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memproses aktivasi pada sistem keamanan backend.",
    });
  }
});

module.exports = router;
