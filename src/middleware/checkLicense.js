const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendLicenseExpiredNotification } = require("../utils/notify");

// Kirim email peringatan ke semua DIREKTUR — HANYA SEKALI per periode kadaluarsa.
// "Sekali per periode" dicek dengan membandingkan expiryNotifiedAt vs expiredAt:
// kalau belum pernah dinotifikasi UNTUK expiredAt yang ini, kirim & catat waktunya.
// Dijalankan "fire-and-forget" (tidak di-await) supaya tidak memperlambat request pengunjung.
function notifyDirekturIfNeeded(license) {
  const alreadyNotifiedForThisExpiry =
    license.expiryNotifiedAt &&
    new Date(license.expiryNotifiedAt).getTime() >=
      new Date(license.expiredAt).getTime();

  if (alreadyNotifiedForThisExpiry) return;

  (async () => {
    try {
      // Tandai dulu SEBELUM kirim email, supaya request-request lain yang datang
      // bersamaan tidak ikut-ikutan mengirim email duplikat (mengurangi race condition).
      await prisma.license.update({
        where: { id: license.id },
        data: { expiryNotifiedAt: new Date() },
      });

      const direktur = await prisma.user.findMany({
        where: { role: "DIREKTUR" },
        select: { email: true },
      });
      const emails = direktur.map((d) => d.email).filter(Boolean);

      await sendLicenseExpiredNotification(emails, license.expiredAt);
    } catch (err) {
      console.error("[checkLicense] Gagal memproses notifikasi lisensi kadaluarsa:", err);
    }
  })();
}

const checkLicense = async (req, res, next) => {
  try {
    // 🛡️ BYPASS: Cek apakah user sudah terverifikasi sebagai ADMIN/DIREKTUR
    // Pastikan middleware auth.js dipasang SEBELUM checkLicense di file routes
    if (
      req.user &&
      (req.user.role === "ADMIN" || req.user.role === "DIREKTUR")
    ) {
      return next();
    }

    const waktuSekarang = new Date();
    const license = await prisma.license.findFirst();

    if (
      !license ||
      waktuSekarang.getTime() > new Date(license.expiredAt).getTime()
    ) {
      if (license) notifyDirekturIfNeeded(license);
      return res.status(403).json({ error: true, message: "Akses diblokir." });
    }

    next();
  } catch (error) {
    next(); // Jika error database, tetap loloskan
  }
};

module.exports = checkLicense;
