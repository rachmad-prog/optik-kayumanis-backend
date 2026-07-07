const router = require("express").Router();
const { dashboardStats } = require("../controllers/admin.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.get("/stats", requireAuth, requireAdmin, dashboardStats);

module.exports = router;
