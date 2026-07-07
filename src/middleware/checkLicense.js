const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
      return res.status(403).json({ error: true, message: "Akses diblokir." });
    }

    next();
  } catch (error) {
    next(); // Jika error database, tetap loloskan
  }
};

module.exports = checkLicense;
