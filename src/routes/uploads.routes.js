const router = require("express").Router();
const { uploadFiles } = require("../controllers/uploads.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

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
