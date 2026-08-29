const router = require("express").Router();
const {
  listArticles,
  getArticleBySlug,
  adminListArticles,
  adminGetArticle,
  createArticle,
  updateArticle,
  deleteArticle,
} = require("../controllers/articles.controller");
const { uploadFiles } = require("../controllers/uploads.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
const checkLicense = require("../middleware/checkLicense");

// Public — harus sebelum /:slug agar tidak tertimpa
router.get("/", checkLicense, listArticles);
router.get("/admin/all", requireAuth, requireAdmin, checkLicense, adminListArticles);
router.get("/admin/id/:id", requireAuth, requireAdmin, checkLicense, adminGetArticle);

// Upload thumbnail artikel (sama seperti produk, pakai R2)
router.post(
  "/upload",
  requireAuth,
  requireAdmin,
  checkLicense,
  upload.single("file"),
  async (req, res) => {
    // Wrapper agar single-file upload tetap mengembalikan format { urls: [...] }
    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diunggah." });
    // Tiru perilaku uploadFiles tapi untuk 1 file saja
    req.files = [req.file];
    return uploadFiles(req, res);
  }
);

// Admin CRUD
router.post("/", requireAuth, requireAdmin, checkLicense, createArticle);
router.put("/:id", requireAuth, requireAdmin, checkLicense, updateArticle);
router.delete("/:id", requireAuth, requireAdmin, checkLicense, deleteArticle);

// Harus paling bawah — menangkap /:slug publik
router.get("/:slug", checkLicense, getArticleBySlug);

module.exports = router;
