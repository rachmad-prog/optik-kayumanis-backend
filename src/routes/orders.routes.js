const router = require("express").Router();
const {
  checkout,
  midtransNotification,
  myOrders,
  getOrder,
  adminListOrders,
  adminUpdateOrderStatus,
} = require("../controllers/orders.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

router.post("/checkout", requireAuth, checkLicense, checkout);
router.post("/midtrans-notification", checkLicense, midtransNotification); // called by Midtrans server, no auth
router.get("/me", requireAuth, checkLicense, myOrders);
router.get(
  "/admin/all",

  requireAuth,
  requireAdmin,
  checkLicense,
  adminListOrders,
);
router.patch(
  "/admin/:id/status",

  requireAuth,
  requireAdmin,
  checkLicense,
  adminUpdateOrderStatus,
);
router.get("/:id", requireAuth, checkLicense, getOrder);

module.exports = router;
