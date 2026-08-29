const { z } = require("zod");
const prisma = require("../config/db");
const { sendOrderInvoiceNotifications, sendInvoiceEmail } = require("../utils/notify");

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
  // Wajib diisi, baik untuk customer yang login maupun guest (tanpa akun),
  // supaya invoice & konfirmasi pesanan tetap bisa dikirim/dihubungi.
  email: z.string().email("Email tidak valid."),
  phone: z.string().min(6),
  shippingAddress: z.string().min(5),
  city: z.string().min(2),
  province: z.string().min(2),
  postalCode: z.string().min(3),
  // Rekening bank yang dipilih pelanggan di halaman checkout, format:
  // "Bank BCA (1234567890)". Opsional karena field ini sebelumnya tidak
  // terdaftar di schema sehingga selalu ke-strip oleh zod — akibatnya
  // paymentType selalu jatuh ke fallback "BANK_TRANSFER" mentah, bukan
  // rekening asli yang dipilih pelanggan. Sekarang didaftarkan supaya
  // benar-benar tersimpan.
  bankName: z.string().min(1).optional(),
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
  const { items, recipientName, email, phone, shippingAddress, city, province, postalCode, bankName } = parsed.data;

  // req.user diisi oleh optionalAuth kalau ada token valid, null kalau guest.
  const isGuest = !req.user;

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
          userId: isGuest ? null : req.user.id,
          guestEmail: isGuest ? email : null,
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

    // Kirim notifikasi email invoice ke Customer & Admin.
    // Untuk guest (tanpa akun), pakai email yang diisi manual saat checkout.
    // Hasilnya (berhasil/gagal) DICATAT ke order supaya admin bisa lihat status-nya
    // di panel /admin/orders dan kirim ulang manual kalau perlu, tanpa buka log server.
    //
    // PENTING: ini SENGAJA di-`await` (bukan fire-and-forget) sebelum response
    // dikirim. Backend ini jalan di Vercel Serverless Functions — begitu response
    // terkirim, environment fungsinya bisa langsung dimatikan, sehingga proses
    // async yang belum selesai (termasuk pencatatan invoiceEmailSent di bawah)
    // bisa terputus di tengah jalan walau email-nya sendiri sempat berhasil
    // terkirim. Meng-await di sini memastikan status yang tercatat di database
    // selalu akurat. Ini menambah sedikit waktu tunggu checkout (~1-3 detik),
    // tapi kegagalan notifikasi tetap TIDAK menggagalkan pesanan (lihat try/catch).
    try {
      const result = await sendOrderInvoiceNotifications(order, req.user || { email });
      await prisma.order.update({
        where: { id: order.id },
        data: {
          invoiceEmailSent: !!result?.ok,
          invoiceEmailError: result?.ok ? null : result?.reason || "Gagal mengirim, alasan tidak diketahui.",
        },
      });
    } catch (err) {
      console.error("[notify] Gagal mengirim notifikasi invoice:", err);
      await prisma.order
        .update({
          where: { id: order.id },
          data: { invoiceEmailSent: false, invoiceEmailError: err?.message || "Gagal mengirim, alasan tidak diketahui." },
        })
        .catch(() => {});
    }

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
  const isOwner = order.userId && order.userId === req.user.id;
  if (!isOwner && !["ADMIN", "DIREKTUR"].includes(req.user.role)) {
    return res.status(403).json({ message: "Tidak diizinkan." });
  }
  res.json({ order });
}

// GET /api/orders/track?orderNumber=...&email=... — untuk customer TANPA akun (guest)
// melacak status pesanannya sendiri, tanpa perlu login.
async function trackOrder(req, res) {
  const { orderNumber, email } = req.query;
  if (!orderNumber || !email) {
    return res.status(400).json({ message: "Nomor pesanan dan email wajib diisi." });
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber: String(orderNumber) },
    include: { items: true },
  });
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  // Cocokkan dengan email guest yang diisi saat checkout, atau (kalau pesanan
  // dibuat oleh akun terdaftar) email akun pemiliknya.
  const owner = order.userId
    ? await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } })
    : null;
  const ownerEmail = order.guestEmail || owner?.email;

  if (!ownerEmail || ownerEmail.toLowerCase() !== String(email).toLowerCase()) {
    return res.status(404).json({ message: "Pesanan tidak ditemukan." });
  }

  res.json({ order });
}

// --- Admin ---

async function adminListOrders(req, res) {
  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: {
          // Foto produk (ambil 1 gambar utama saja) supaya admin bisa langsung
          // lihat produk apa yang dipesan tanpa buka halaman produk terpisah.
          // Pakai relasi productId, bukan snapshot di OrderItem, jadi tetap
          // jalan untuk order lama; kalau produknya sudah dihapus, product
          // akan null dan frontend fallback ke placeholder.
          product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
        },
      },
      user: { select: { name: true, email: true } },
    },
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

// POST /api/orders/admin/:id/resend-invoice — kirim ulang email invoice ke customer.
// Berguna kalau pengiriman otomatis saat checkout gagal (mis. SMTP sempat bermasalah).
async function adminResendInvoice(req, res) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true, user: { select: { email: true } } },
  });
  if (!order) return res.status(404).json({ message: "Pesanan tidak ditemukan." });

  const toEmail = order.guestEmail || order.user?.email;
  if (!toEmail) {
    return res.status(400).json({ message: "Pesanan ini tidak memiliki alamat email tujuan." });
  }

  const result = await sendInvoiceEmail(order, toEmail);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      invoiceEmailSent: !!result?.ok,
      invoiceEmailError: result?.ok ? null : result?.reason || "Gagal mengirim, alasan tidak diketahui.",
    },
  });

  if (!result?.ok) {
    return res.status(502).json({ message: `Gagal mengirim ulang invoice: ${result?.reason || "tidak diketahui"}` });
  }
  res.json({ message: `Invoice berhasil dikirim ulang ke ${toEmail}.` });
}

module.exports = {
  checkout,
  myOrders,
  getOrder,
  trackOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  adminResendInvoice,
};
