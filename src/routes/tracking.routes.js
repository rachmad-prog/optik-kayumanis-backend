const router = require("express").Router();
const { getTracking, updateTracking } = require("../controllers/tracking.controller");
const { requireAuth } = require("../middleware/auth");

// Middleware khusus untuk memastikan hanya DIREKTUR yang bisa ubah tracking
function requireDirektur(req, res, next) {
  if (!req.user || req.user.role !== "DIREKTUR") {
    return res.status(403).json({ message: "Akses khusus Direktur." });
  }
  next();
}

// GET publik — frontend butuh ini untuk inject script tracking
router.get("/", getTracking);

// PUT hanya DIREKTUR
router.put("/", requireAuth, requireDirektur, updateTracking);

module.exports = router;
