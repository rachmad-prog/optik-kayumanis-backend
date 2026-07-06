const router = require("express").Router();
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categories.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

router.get("/", listCategories);
router.post("/", requireAuth, requireAdmin, checkLicense, createCategory);
router.put("/:id", requireAuth, requireAdmin, checkLicense, updateCategory);
router.delete("/:id", requireAuth, requireAdmin, checkLicense, deleteCategory);

module.exports = router;
