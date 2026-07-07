const router = require("express").Router();
const {
  getContent,
  updateContent,
} = require("../controllers/content.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

router.get("/", checkLicense, getContent);
router.put("/", requireAuth, requireAdmin, checkLicense, updateContent);

module.exports = router;
