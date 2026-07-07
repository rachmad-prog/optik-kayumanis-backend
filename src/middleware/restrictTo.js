// backend/src/middleware/restrictTo.js
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user biasanya di-set oleh middleware auth/jwt login kamu (misal authMiddleware)
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Akses ditolak. Anda tidak memiliki hak akses untuk tindakan ini.",
      });
    }
    next();
  };
};

module.exports = restrictTo;
