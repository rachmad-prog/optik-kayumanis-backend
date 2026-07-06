const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// IMPORT MIDDLEWARE PENGAMAN (Sesuaikan dengan file auth bawaan projekmu jika berbeda nama)
const { requireAuth } = require("../middleware/auth"); // pastikan path-nya benar menuju file verifikasi JWT/Login kamu
const restrictTo = require("../middleware/restrictTo");

// Jalur API untuk menerima token dan waktu kustom dari modal frontend
router.post(
  "/activate",
  requireAuth,
  restrictTo("DIREKTUR"),
  async (req, res) => {
    const { inputToken, customExpiredAt } = req.body; // Menerima waktu spesifik dari frontend

    try {
      if (!inputToken || !customExpiredAt) {
        return res.status(400).json({
          success: false,
          message: "Token dan batas waktu lisensi tidak boleh kosong.",
        });
      }

      // 1. Ambil token mentah dari .env untuk memastikan kecocokan sistem dasar
      // const tokenMentahEnv = process.env.WEBSITE_TOKEN;
      const tokenMentahEnv = process.env.WEBSITE_TOKEN
        ? process.env.WEBSITE_TOKEN.replace(/"/g, "")
        : "";
      if (inputToken.trim() !== tokenMentahEnv) {
        return res.status(400).json({
          success: false,
          message: "Token yang Anda masukkan salah / tidak valid.",
        });
      }

      // 2. Cari data lisensi pertama di database
      const license = await prisma.license.findFirst();

      if (!license) {
        return res.status(404).json({
          success: false,
          message: "Data lisensi tidak ditemukan di database.",
        });
      }

      // 3. Konversi input waktu dari frontend menjadi Objek Tanggal JavaScript yang sah
      const targetExpired = new Date(customExpiredAt);

      // Validasi apakah string tanggal yang dikirim rusak atau tidak valid
      if (isNaN(targetExpired.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Format pilihan tanggal/waktu tidak valid.",
        });
      }

      // 4. Update data di PostgreSQL via Prisma menggunakan waktu kustom
      await prisma.license.update({
        where: { id: license.id },
        data: {
          isActive: true,
          expiredAt: targetExpired, // Waktu terkunci pas sampai ke menit-menitnya
        },
      });

      // Format tampilan waktu lokal Indonesia untuk notifikasi sukses
      const opsiWaktu = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      const waktuLokalFormat = targetExpired.toLocaleDateString(
        "id-ID",
        opsiWaktu,
      );

      return res.json({
        success: true,
        message: `Aktivasi berhasil! Website diatur aktif sampai: ${waktuLokalFormat} WIB.`,
      });
    } catch (error) {
      console.error("❌ Error Aktivasi Lisensi:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal memproses aktivasi pada sistem keamanan backend.",
      });
    }
  },
);

module.exports = router;
