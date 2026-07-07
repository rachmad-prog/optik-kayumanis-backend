const { z } = require("zod");
const prisma = require("../config/db");
const { snap } = require("../utils/midtrans");
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

// POST /api/orders/checkout — creates order + Midtrans Snap transaction
async function checkout(req, res) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { items, recipientName, phone, shippingAddress, city, province, postalCode } = parsed.data;

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

  try {
    const order = await prisma.order.create({
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
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Decrement stock
    await Promise.all(
      orderItemsData.map((item) =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      )
    );

    // Create Midtrans Snap transaction
    const transaction = await snap.createTransaction({
      transaction_details: {
        order_id: order.orderNumber,
        gross_amount: total,
      },
      customer_details: {
        first_name: recipientName,
        phone,
        email: req.user.email,
      },
      item_details: [
        ...orderItemsData.map((i) => ({
          id: i.productId,
          name: i.name.slice(0, 50),
          price: i.price,
          quantity: i.quantity,
        })),
        { id: "SHIPPING", name: "Ongkos Kirim", price: SHIPPING_COST, quantity: 1 },
      ],
    });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { midtransOrderId: order.orderNumber, midtransToken: transaction.token },
      include: { items: true },
    });

    // Kirim invoice ke customer (email + WhatsApp) begitu order & transaksi
    // pembayaran berhasil dibuat — tidak menunggu (fire-and-forget) supaya
    // respons checkout tetap cepat, dan tidak pernah menggagalkan checkout
    // walau pengiriman notifikasi gagal (lihat utils/notify.js).
    sendOrderInvoiceNotifications(updated, req.user).catch((err) =>
      console.error("[notify] Gagal mengirim notifikasi invoice:", err)
    );

    res.status(201).json({ order: updated, snapToken: transaction.token, redirectUrl: transaction.redirect_url });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Gagal membuat pesanan." });
  }
}

// POST /api/orders/midtrans-notification — Midtrans webhook
async function midtransNotification(req, res) {
  const { coreApi } = require("../utils/midtrans");
  try {
    const statusResponse = await coreApi.transaction.notification(req.body);
    const { order_id, transaction_status, fraud_status, payment_type } = statusResponse;

    let status = "PENDING";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      status = fraud_status === "challenge" ? "PENDING" : "PAID";
    } else if (transaction_status === "deny" || transaction_status === "cancel") {
      status = "CANCELLED";
    } else if (transaction_status === "expire") {
      status = "EXPIRED";
    } else if (transaction_status === "pending") {
      status = "PENDING";
    }

    await prisma.order.update({
      where: { orderNumber: order_id },
      data: {
        status,
        paymentType: payment_type,
        paidAt: status === "PAID" ? new Date() : undefined,
      },
    });

    res.status(200).json({ message: "OK" });
  } catch (err) {
    res.status(500).json({ message: "Gagal memproses notifikasi." });
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
  if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
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
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } });
  res.json({ order });
}

module.exports = {
  checkout,
  midtransNotification,
  myOrders,
  getOrder,
  adminListOrders,
  adminUpdateOrderStatus,
};
