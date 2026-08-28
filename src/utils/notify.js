const nodemailer = require("nodemailer");

// ---------------------------------------------------------------------
// Helper: format angka jadi Rupiah, sama seperti di frontend (lib/api.js)
// ---------------------------------------------------------------------
function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// ---------------------------------------------------------------------
// Helper: susun isi invoice (dipakai untuk email & WhatsApp)
// ---------------------------------------------------------------------
function buildInvoiceText(order) {
  const itemLines = order.items
    .map(
      (i) =>
        `- ${i.name} x${i.quantity} — ${formatRupiah(i.price * i.quantity)}`,
    )
    .join("\n");

  return `Halo ${order.recipientName},

Terima kasih telah berbelanja di Optik Kayumanis!
Berikut rincian pesananmu:

No. Pesanan : ${order.orderNumber}
Tanggal     : ${new Date(order.createdAt).toLocaleString("id-ID")}

Rincian Pesanan:
${itemLines}

Subtotal     : ${formatRupiah(order.subtotal)}
Ongkos Kirim : ${formatRupiah(order.shippingCost)}
Total        : ${formatRupiah(order.total)}

Alamat Pengiriman:
${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}

Pesanan ini akan diproses setelah pembayaran kami terima. Silakan selesaikan
pembayaran melalui halaman yang sudah terbuka.

Terima kasih,
Optik Kayumanis`;
}

// ---------------------------------------------------------------------
// EMAIL — via Nodemailer (SMTP apa saja: Gmail, provider hosting, dll)
//
// Ada 2 akun SMTP terpisah:
// - CS   (SMTP_CS_*)    → dipakai untuk email yang dilihat CUSTOMER
//                          (invoice pesanan), supaya customer bisa
//                          langsung balas ke alamat CS kalau ada pertanyaan.
// - ADMIN (SMTP_ADMIN_*) → dipakai untuk notifikasi INTERNAL
//                          (pesanan baru masuk, lisensi kadaluarsa),
//                          jadi kotak masuk admin tidak campur dengan
//                          email customer.
//
// Kalau salah satu belum diisi di .env, otomatis fallback pakai variabel
// SMTP_* yang lama (satu akun untuk semua) supaya tetap jalan.
// ---------------------------------------------------------------------
const transporters = {};

function buildCreds(prefix) {
  const host = process.env[`SMTP_${prefix}_HOST`] || process.env.SMTP_HOST;
  const port = process.env[`SMTP_${prefix}_PORT`] || process.env.SMTP_PORT;
  const user = process.env[`SMTP_${prefix}_USER`] || process.env.SMTP_USER;
  const pass = process.env[`SMTP_${prefix}_PASS`] || process.env.SMTP_PASS;
  const from =
    process.env[`SMTP_${prefix}_FROM`] ||
    process.env.SMTP_FROM ||
    (user ? `"Optik Kayumanis" <${user}>` : undefined);
  return { host, port, user, pass, from };
}

function getTransporter(prefix) {
  if (!transporters[prefix]) {
    const { host, port, user, pass } = buildCreds(prefix);
    if (!host || !user || !pass) return null;
    transporters[prefix] = nodemailer.createTransport({
      host,
      port: Number(port || 587),
      secure: String(port) === "465", // true untuk port 465, false untuk 587/25
      auth: { user, pass },
    });
  }
  return transporters[prefix];
}

async function sendInvoiceEmail(order, toEmail) {
  const { from } = buildCreds("CS");
  const transporter = getTransporter("CS");
  if (!transporter) {
    console.warn(
      "[notify] SMTP CS belum dikonfigurasi di .env — email invoice dilewati.",
    );
    return;
  }
  if (!toEmail) {
    console.warn(
      "[notify] Tidak ada alamat email tujuan — email invoice dilewati.",
    );
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Invoice Pesanan ${order.orderNumber} — Optik Kayumanis`,
      text: buildInvoiceText(order),
    });
    console.log(`[notify] Email invoice (CS) terkirim ke ${toEmail}`);
  } catch (err) {
    // Sengaja tidak di-throw ulang: kegagalan kirim notifikasi TIDAK BOLEH
    // menggagalkan proses checkout / pembayaran.
    console.error("[notify] Gagal mengirim email invoice:", err.message);
  }
}

// ---------------------------------------------------------------------
// WHATSAPP — via Fonnte (https://fonnte.com)
// Fonnte dipilih karena setup-nya simpel (scan QR sekali, dapat token),
// ada kuota gratis untuk testing, dan API-nya cuma REST biasa.
// Kalau kamu mau pakai provider lain (Wablas, Twilio WA, dll), tinggal
// ganti isi fungsi sendInvoiceWhatsapp ini saja — bagian lain tidak perlu diubah.
// ---------------------------------------------------------------------
function normalizePhoneToWhatsapp(phone) {
  let p = String(phone).replace(/[^0-9]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return p;
}

async function sendInvoiceWhatsapp(order) {
  if (!process.env.FONNTE_TOKEN) {
    console.warn(
      "[notify] FONNTE_TOKEN belum dikonfigurasi di .env — WhatsApp invoice dilewati.",
    );
    return;
  }

  try {
    const target = normalizePhoneToWhatsapp(order.phone);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: process.env.FONNTE_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        target,
        message: buildInvoiceText(order),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === false) {
      console.error("[notify] Gagal mengirim WhatsApp invoice:", data);
    } else {
      console.log(`[notify] WhatsApp invoice terkirim ke ${target}`);
    }
  } catch (err) {
    console.error("[notify] Gagal mengirim WhatsApp invoice:", err.message);
  }
}

// ---------------------------------------------------------------------
// Dipanggil dari controller: kirim notifikasi invoice, tanpa pernah
// melempar error ke pemanggilnya (checkout tetap sukses walau
// notifikasi gagal).
//
// CATATAN: notifikasi WhatsApp (Fonnte) SEMENTARA DINONAKTIFKAN karena
// device Fonnte sering disconnect sehingga pesan tidak terkirim.
// Kodenya (sendInvoiceWhatsapp di atas) SENGAJA TIDAK DIHAPUS supaya
// gampang diaktifkan lagi nanti — cukup un-comment baris
// `sendInvoiceWhatsapp(order),` di bawah ini kalau device Fonnte sudah
// stabil connect lagi. Untuk saat ini, notifikasi hanya lewat email.
// ---------------------------------------------------------------------
async function sendAdminOrderAlert(order) {
  const { user: adminUser, from } = buildCreds("ADMIN");
  const transporter = getTransporter("ADMIN");
  if (!transporter) return;

  // ADMIN_EMAIL bisa dipakai untuk override alamat TUJUAN kalau kamu mau
  // notifikasi masuk ke inbox yang beda dari akun pengirimnya. Kalau
  // dikosongkan, otomatis dikirim ke alamat akun SMTP_ADMIN_USER sendiri.
  const adminEmail = process.env.ADMIN_EMAIL || adminUser;
  if (!adminEmail) return;

  try {
    const itemLines = order.items
      .map((i) => `- ${i.name} x${i.quantity} (${formatRupiah(i.price * i.quantity)})`)
      .join("\n");

    const text = `Halo Admin Optik Kayumanis,

Ada PESANAN BARU yang masuk ke sistem:

No. Pesanan : ${order.orderNumber}
Pemesan     : ${order.recipientName} (${order.phone})
Total       : ${formatRupiah(order.total)}

Rincian Produk:
${itemLines}

Alamat Pengiriman:
${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}

Silakan cek panel admin di /admin/orders untuk memproses pesanan ini.`;

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `🔔 [Pesanan Baru] ${order.orderNumber} - ${order.recipientName}`,
      text,
    });
    console.log(`[notify] Notifikasi pesanan baru terkirim ke Admin (${adminEmail})`);
  } catch (err) {
    console.error("[notify] Gagal mengirim email pesanan baru ke Admin:", err.message);
  }
}

async function sendOrderInvoiceNotifications(order, user) {
  await Promise.allSettled([
    sendInvoiceEmail(order, user?.email),
    sendAdminOrderAlert(order),
    // sendInvoiceWhatsapp(order),
  ]);
}

// ---------------------------------------------------------------------
// NOTIFIKASI LISENSI KADALUARSA — dikirim ke semua user berrole DIREKTUR
// saat backend mendeteksi masa aktif website sudah habis.
// Dipanggil dari middleware/checkLicense.js, HANYA SEKALI per periode
// kadaluarsa (lihat logic expiryNotifiedAt di checkLicense.js).
// ---------------------------------------------------------------------
async function sendLicenseExpiredNotification(direkturEmails, expiredAt) {
  const { from } = buildCreds("ADMIN");
  const transporter = getTransporter("ADMIN");
  if (!transporter) {
    console.warn(
      "[notify] SMTP Admin belum dikonfigurasi di .env — notifikasi lisensi kadaluarsa dilewati.",
    );
    return;
  }
  if (!direkturEmails || direkturEmails.length === 0) {
    console.warn(
      "[notify] Tidak ada akun DIREKTUR dengan email terdaftar — notifikasi lisensi dilewati.",
    );
    return;
  }

  const waktu = new Date(expiredAt).toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const text = `Halo,

Masa aktif lisensi website Optik Kayumanis telah berakhir pada ${waktu} WIB.

Akses publik (produk, gambar, checkout, dll) untuk pengunjung website SUDAH OTOMATIS DIBLOKIR
mulai saat ini. Panel admin masih bisa diakses seperti biasa oleh Direktur/Admin.

Silakan login ke panel admin dan buka menu "Lisensi Sistem" untuk generate token baru dan
memperpanjang masa aktif website.

— Sistem Optik Kayumanis (notifikasi otomatis)`;

  try {
    await transporter.sendMail({
      from,
      to: direkturEmails.join(","),
      subject: "⚠️ Lisensi Website Optik Kayumanis Telah Kadaluarsa",
      text,
    });
    console.log(
      `[notify] Email peringatan lisensi kadaluarsa terkirim ke: ${direkturEmails.join(", ")}`,
    );
  } catch (err) {
    console.error(
      "[notify] Gagal mengirim email peringatan lisensi kadaluarsa:",
      err.message,
    );
  }
}

module.exports = { sendOrderInvoiceNotifications, sendLicenseExpiredNotification };
