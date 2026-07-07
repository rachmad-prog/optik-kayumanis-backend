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
// ---------------------------------------------------------------------
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT) === "465", // true untuk port 465, false untuk 587/25
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendInvoiceEmail(order, toEmail) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn(
      "[notify] SMTP belum dikonfigurasi di .env — email invoice dilewati.",
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
    await getTransporter().sendMail({
      from:
        process.env.SMTP_FROM || `"Optik Kayumanis" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Invoice Pesanan ${order.orderNumber} — Optik Kayumanis`,
      text: buildInvoiceText(order),
    });
    console.log(`[notify] Email invoice terkirim ke ${toEmail}`);
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
async function sendOrderInvoiceNotifications(order, user) {
  await Promise.allSettled([
    sendInvoiceEmail(order, user?.email),
    // sendInvoiceWhatsapp(order),
    // dinonaktifkan sementara — lihat catatan di atas
  ]);
}

// ---------------------------------------------------------------------
// NOTIFIKASI LISENSI KADALUARSA — dikirim ke semua user berrole DIREKTUR
// saat backend mendeteksi masa aktif website sudah habis.
// Dipanggil dari middleware/checkLicense.js, HANYA SEKALI per periode
// kadaluarsa (lihat logic expiryNotifiedAt di checkLicense.js).
// ---------------------------------------------------------------------
async function sendLicenseExpiredNotification(direkturEmails, expiredAt) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn(
      "[notify] SMTP belum dikonfigurasi di .env — notifikasi lisensi kadaluarsa dilewati.",
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
    await getTransporter().sendMail({
      from:
        process.env.SMTP_FROM || `"Optik Kayumanis" <${process.env.SMTP_USER}>`,
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
