const { z } = require("zod");
const prisma = require("../config/db");
const { sendOrderInvoiceNotifications } = require("../utils/notify");

const SHIPPING_COST = 20000; // flat rate, in IDR

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  recipientName: z.string().min(2),
  phone: z.string().min(6),
  shippingAddress: z.string().min(5),
  city: z.string().min(2),
  province: z.string().min(2),
  postalCode: z.string().min(3),
});

function generateOrderNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `OK-${stamp}-${rand}`;
}

// POST /api/orders/checkout — creates order, customer transfers manually to selected bank
async function checkout(req, res) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { items, recipientName, phone, shippingAddress, city, province, postalCode, bankName } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  if (products.length !== productIds.length) {
    return res.status(400).json({ message: "Beberapa produk tidak ditemukan." });
  }

  let subtotal = 0;
  const orderItemsData = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product.stock < item.quantity) {
      throw Object.assign(new Error(`Stok ${product.name} tidak cukup.`), { status: 400 });
    }
    subtotal += product.price * item.quantity;
    return {
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    };
  });

  const total = subtotal + SHIPPING_COST;
  const orderNumber = generateOrderNumber();

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const item of orderItemsData) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          const product = products.find((p) => p.id === item.productId);
          throw Object.assign(
            new Error(`Stok ${product?.name || "produk"} tidak cukup.`),
            { status: 400 }
          );
        }
      }
      return tx.order.create({
        data: {
          orderNumber,
          userId: req.user.id,
          subtotal,
          shippingCost: SHIPPING_COST,
          total,
          recipientName,
          phone,
          shippingAddress,
          city,
          province,
          postalCode,
          paymentType: bankName || "BANK_TRANSFER",
          items: { create: orderItemsData },
        },
        include: { items: true },
      });
    });

    // Kirim notifikasi email invoice ke Customer & Admin
    sendOrderInvoiceNotifications(order, req.user).catch((err) =>
      console.error("[notify] Gagal mengirim notifikasi invoice:", err)
    );

    return res.status(201).json({ order, message: "Pesanan berhasil dibuat. Silakan lakukan transfer bank." });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Gagal membuat pesanan." });
  }
}

// GET /api/orders/me — order history for logged-in user
async function myOrders(req, res) {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: orders });
}

// GET /api/orders/:id
async function getOrder(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  if (order.userId !== req.user.id && !["ADMIN", "DIREKTUR"].includes(req.user.role)) {
    return res.status(403).json({ message: "Tidak diizinkan." });
  }
  res.json({ order });
}

// --- Admin ---

async function adminListOrders(req, res) {
  const orders = await prisma.order.findMany({
    include: { items: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: orders });
}

async function adminUpdateOrderStatus(req, res) {
  const { status } = req.body;
  const valid = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED", "EXPIRED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ message: "Status tidak valid." });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status,
      // Catat waktu pembayaran begitu admin menandai pesanan sebagai PAID
      // (verifikasi manual setelah cek mutasi rekening / bukti transfer)
      paidAt: status === "PAID" ? new Date() : undefined,
    },
  });
  res.json({ order });
}

module.exports = {
  checkout,
  myOrders,
  getOrder,
  adminListOrders,
  adminUpdateOrderStatus,
};
