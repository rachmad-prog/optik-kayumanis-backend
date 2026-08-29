const router = require("express").Router();
const { uploadFiles, getFileProxy } = require("../controllers/uploads.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

// GET /api/uploads/file/* — Public access proxy endpoint for Cloudflare R2 files
router.get("/file/*", getFileProxy);

// POST /api/uploads — multipart/form-data, field name "files", up to 10 files.
// Returns { urls: [...] }. Any admin screen that needs to attach an image
// (hero slides, etc) can use this instead of a feature-specific endpoint.
router.post(
  "/",
  requireAuth,
  requireAdmin,
  checkLicense,
  upload.array("files", 10),
  uploadFiles,
);

module.exports = router;
