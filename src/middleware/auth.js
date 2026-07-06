const { verifyToken } = require("../utils/jwt");
const prisma = require("../config/db");

// Requires a valid Bearer token; attaches req.user
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: "Silakan login terlebih dahulu." });
    }
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ message: "Akun tidak ditemukan." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Sesi tidak valid atau sudah kedaluwarsa." });
  }
}

// Requires req.user to be an ADMIN or DIREKTUR (use after requireAuth)
function requireAdmin(req, res, next) {
  if (!req.user || !["ADMIN", "DIREKTUR"].includes(req.user.role)) {
    return res.status(403).json({ message: "Akses khusus admin." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
