const router = require("express").Router();
const {
  listProducts,
  getProductBySlug,
  adminGetProduct,
  adminListProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/products.controller");
const { uploadFiles } = require("../controllers/uploads.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

// 1. Import middleware yang baru kamu buat
const checkLicense = require("../middleware/checkLicense");

// Public
router.get("/", checkLicense, listProducts);
router.get(
  "/admin/all",
  requireAuth,
  requireAdmin,
  checkLicense,
  adminListProducts,
);
router.get(
  "/admin/id/:id",

  requireAuth,
  requireAdmin,
  checkLicense,
  adminGetProduct,
);
router.get("/:slug", checkLicense, getProductBySlug);

// Admin
// Kept here for backward compatibility with the product form — same handler as /api/uploads.
router.post(
  "/upload",

  requireAuth,
  requireAdmin,
  checkLicense,
  upload.array("files", 10),
  uploadFiles,
);
router.post("/", requireAuth, requireAdmin, checkLicense, createProduct);
router.put("/:id", requireAuth, requireAdmin, checkLicense, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, checkLicense, deleteProduct);

module.exports = router;
