const router = require("express").Router();
const {
  checkout,
  myOrders,
  getOrder,
  trackOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  adminResendInvoice,
} = require("../controllers/orders.controller");
const { requireAuth, requireAdmin, optionalAuth } = require("../middleware/auth");

// Import middleware lisensi
const checkLicense = require("../middleware/checkLicense");

// optionalAuth: checkout boleh dilakukan tanpa login (guest), tapi kalau
// customer sedang login, pesanan tetap otomatis terhubung ke akunnya.
router.post("/checkout", optionalAuth, checkLicense, checkout);
router.get("/track", checkLicense, trackOrder);
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
router.post(
  "/admin/:id/resend-invoice",

  requireAuth,
  requireAdmin,
  checkLicense,
  adminResendInvoice,
);
router.get("/:id", requireAuth, checkLicense, getOrder);

module.exports = router;
