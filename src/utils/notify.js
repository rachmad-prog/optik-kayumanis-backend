const nodemailer = require("nodemailer");
const { getMergedContent } = require("../controllers/content.controller");

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
// Helper: ubah nomor HP lokal (08xxx) jadi format internasional wa.me (62xxx),
// dan siapkan URL WhatsApp berisi draf pesan follow up ke customer.
// ---------------------------------------------------------------------
function formatWaNumber(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return `62${digits}`;
}

function buildAdminFollowUpWaUrl(order) {
  const waNumber = formatWaNumber(order.phone);
  if (!waNumber) return null;
  const text = encodeURIComponent(
    `Halo Kak ${order.recipientName}, terima kasih sudah order di Optik Kayumanis (No. Pesanan ${order.orderNumber}). Boleh minta info/konfirmasi terkait pesanannya? 🙏`,
  );
  return `https://wa.me/${waNumber}?text=${text}`;
}

// ---------------------------------------------------------------------
// Helper: siapkan link WhatsApp untuk PELANGGAN konfirmasi pembayaran ke
// admin toko (kebalikan dari buildAdminFollowUpWaUrl yang mengarah ke HP
// pelanggan). Nomor diambil dari pengaturan situs (footer.whatsappLink),
// dengan fallback nomor default kalau admin belum mengisinya.
// ---------------------------------------------------------------------
function buildCustomerConfirmWaUrl(order, whatsappLink) {
  const base = whatsappLink || "https://wa.me/6281234567890";
  const text = encodeURIComponent(
    `Halo Optik Kayumanis, saya sudah transfer untuk pesanan ${order.orderNumber}.\n\n` +
      `Nama: ${order.recipientName}\n` +
      `Total Pembayaran: ${formatRupiah(order.total)}\n` +
      `Transfer ke: ${order.paymentType || "Bank Transfer"}\n\n` +
      `Mohon verifikasi pesanan saya. Terima kasih!`,
  );
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}text=${text}`;
}

// ---------------------------------------------------------------------
// Helper: ubah order.paymentType ("Bank BCA (1234567890)") jadi
// {bankName, accountNumber, accountName} yang rapi untuk ditampilkan.
// Kalau order lama tidak punya paymentType yang valid (mis. sebelum bug
// bankName diperbaiki, sempat tersimpan literal "BANK_TRANSFER"), fallback
// ke rekening pertama yang admin sudah set di pengaturan situs supaya
// pelanggan tetap lihat nomor rekening asli, bukan teks enum mentah.
// ---------------------------------------------------------------------
function resolveBankInfo(order, content) {
  const raw = (order.paymentType || "").trim();
  const isPlaceholder = !raw || raw === "BANK_TRANSFER";

  if (!isPlaceholder) {
    const match = raw.match(/^(.*)\s\(([^)]+)\)\s*$/);
    if (match) {
      return { bankName: match[1].trim(), accountNumber: match[2].trim(), accountName: null };
    }
    return { bankName: raw, accountNumber: null, accountName: null };
  }

  const fallback = content?.bankAccounts?.[0];
  if (fallback) {
    return {
      bankName: fallback.bankName,
      accountNumber: fallback.accountNumber,
      accountName: fallback.accountName,
    };
  }

  return { bankName: "Rekening akan dikonfirmasi oleh admin", accountNumber: null, accountName: null };
}

// ---------------------------------------------------------------------
// Helper: susun isi invoice (dipakai untuk email & WhatsApp)
// ---------------------------------------------------------------------
function buildInvoiceText(order, whatsappLink, content) {
  const bankInfo = resolveBankInfo(order, content);
  const bankLines = [
    bankInfo.bankName,
    bankInfo.accountName ? `a.n. ${bankInfo.accountName}` : null,
    bankInfo.accountNumber ? `No. Rekening/VA: ${bankInfo.accountNumber}` : null,
  ].filter(Boolean).join("\n");

  const itemLines = order.items
    .map(
      (i) =>
        `- ${i.name} x${i.quantity} — ${formatRupiah(i.price * i.quantity)}`,
    )
    .join("\n");

  const waUrl = buildCustomerConfirmWaUrl(order, whatsappLink);

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

Instruksi Pembayaran:
Silakan transfer sebesar ${formatRupiah(order.total)} ke:
${bankLines}

Setelah transfer, mohon konfirmasi ke admin kami via WhatsApp:
${waUrl}

Alamat Pengiriman:
${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}

Pesanan ini akan diproses setelah pembayaran kami terima.

Terima kasih,
Optik Kayumanis`;
}

// ---------------------------------------------------------------------
// Helper: versi HTML invoice, dengan tombol WhatsApp konfirmasi ke admin
// yang bisa langsung diklik dari email.
// ---------------------------------------------------------------------
function buildInvoiceHtml(order, whatsappLink, content) {
  const waUrl = buildCustomerConfirmWaUrl(order, whatsappLink);
  const bankInfo = resolveBankInfo(order, content);

  const itemRowsHtml = order.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0;color:#334155;">${i.name} × ${i.quantity}</td><td style="padding:4px 0;text-align:right;color:#334155;">${formatRupiah(i.price * i.quantity)}</td></tr>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
      <p>Halo ${order.recipientName},</p>
      <p>Terima kasih telah berbelanja di <strong>Optik Kayumanis</strong>! Berikut rincian pesananmu:</p>

      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
        <tr><td style="padding:4px 0;color:#64748b;">No. Pesanan</td><td style="padding:4px 0;text-align:right;">${order.orderNumber}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Tanggal</td><td style="padding:4px 0;text-align:right;">${new Date(order.createdAt).toLocaleString("id-ID")}</td></tr>
      </table>

      <p style="margin:16px 0 4px;font-weight:bold;">Rincian Pesanan:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRowsHtml}</table>

      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;border-top:1px solid #e2e8f0;padding-top:8px;">
        <tr><td style="padding:4px 0;color:#64748b;">Subtotal</td><td style="padding:4px 0;text-align:right;">${formatRupiah(order.subtotal)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Ongkos Kirim</td><td style="padding:4px 0;text-align:right;">${formatRupiah(order.shippingCost)}</td></tr>
        <tr><td style="padding:6px 0;font-weight:bold;">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${formatRupiah(order.total)}</td></tr>
      </table>

      <div style="margin:20px 0;padding:16px;background-color:#0f172a;border-radius:12px;color:#ffffff;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#e9d8a6;">Instruksi Pembayaran</p>
        <p style="margin:0;font-size:16px;font-weight:bold;">${bankInfo.bankName}</p>
        ${bankInfo.accountName ? `<p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Atas Nama: ${bankInfo.accountName}</p>` : ""}
        ${
          bankInfo.accountNumber
            ? `<table role="presentation" style="margin:12px 0 0;width:100%;">
                <tr>
                  <td style="padding:10px 12px;background-color:#1e293b;border-radius:10px;">
                    <table role="presentation" style="width:100%;">
                      <tr>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#94a3b8;">Nomor Rekening / VA</p>
                          <p style="margin:2px 0 0;font-size:20px;font-weight:bold;letter-spacing:2px;font-family:'Courier New',Courier,monospace;color:#ffffff;">${bankInfo.accountNumber}</p>
                        </td>
                        <td style="vertical-align:middle;text-align:right;width:36px;">
                          <span title="Salin nomor" style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#334155;border-radius:8px;font-size:14px;">📋</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:6px 0 0;font-size:11px;color:#64748b;">📋 Tekan &amp; tahan nomor di atas untuk menyalin</p>`
            : ""
        }
        <p style="margin:12px 0 0;font-size:13px;color:#cbd5e1;">Transfer sebesar <strong>${formatRupiah(order.total)}</strong> ke rekening di atas.</p>
      </div>

      <div style="margin:20px 0;text-align:center;">
        <a href="${waUrl}" target="_blank" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;">
          💬 Konfirmasi Pembayaran via WhatsApp
        </a>
      </div>

      <p style="margin:16px 0 4px;font-weight:bold;">Alamat Pengiriman:</p>
      <p style="margin:0;font-size:14px;color:#334155;">${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}</p>

      <p style="font-size:13px;color:#64748b;margin-top:20px;">Pesanan ini akan diproses setelah pembayaran kami terima.</p>
      <p style="font-size:14px;margin-top:20px;">Terima kasih,<br/>Optik Kayumanis</p>
    </div>
  `;
}

// ---------------------------------------------------------------------
// EMAIL — via Nodemailer (SMTP apa saja: Gmail, provider hosting, dll)
//
// Disederhanakan: SEMUA email keluar (invoice ke pelanggan & notifikasi
// pesanan baru ke admin) pakai 1 akun SMTP yang sama, yaitu SMTP_ADMIN_*.
// Admin/CS toko bisa follow up pelanggan langsung dari inbox yang sama,
// tidak perlu setup akun email terpisah lagi.
//
// (SMTP_CS_* di .env lama, kalau masih ada, sekarang tidak dipakai lagi.
// Boleh dihapus, atau dibiarkan saja tidak masalah.)
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
      // Timeout eksplisit supaya kalau port SMTP diblokir firewall/ISP,
      // proses gagal cepat dengan pesan jelas (ETIMEDOUT), bukan menggantung diam.
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporters[prefix];
}

// Terjemahkan error SMTP teknis jadi pesan yang gampang didiagnosis.
function explainSmtpError(err) {
  const code = err?.code || "";
  const msg = (err?.response || err?.message || "").toString();

  if (code === "EAUTH" || /535|Username and Password not accepted/i.test(msg)) {
    return "AUTH GAGAL — App Password salah/kadaluarsa, atau 2-Step Verification belum aktif di akun Gmail pengirim. Generate ulang App Password baru.";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") {
    return "KONEKSI GAGAL/TIMEOUT — kemungkinan port SMTP (587/465) diblokir oleh firewall/antivirus/ISP tempat server ini berjalan. Coba jaringan lain atau buka port tsb.";
  }
  if (/rate limit|too many/i.test(msg)) {
    return "DITOLAK GMAIL — kuota/rate limit akun Gmail terlampaui untuk sementara. Coba lagi beberapa menit lagi.";
  }
  return msg || "Error tidak dikenali, lihat detail lengkap di atas.";
}

async function sendInvoiceEmail(order, toEmail) {
  // Dulu pakai akun SMTP_CS_* terpisah, sekarang disederhanakan: pakai akun
  // SMTP_ADMIN_* yang sama dengan yang mengirim notifikasi ke admin — supaya
  // tidak perlu setup 2 akun email berbeda, cukup 1 akun toko saja.
  const { from } = buildCreds("ADMIN");
  const transporter = getTransporter("ADMIN");
  if (!transporter) {
    console.warn(
      "[notify] SMTP Admin belum dikonfigurasi di .env — email invoice dilewati.",
    );
    return { ok: false, reason: "SMTP belum dikonfigurasi." };
  }
  if (!toEmail) {
    console.warn(
      "[notify] Tidak ada alamat email tujuan — email invoice dilewati.",
    );
    return { ok: false, reason: "Tidak ada alamat email tujuan." };
  }

  try {
    const content = await getMergedContent().catch(() => null);
    const whatsappLink = content?.footer?.whatsappLink;

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Invoice Pesanan ${order.orderNumber} — Optik Kayumanis`,
      text: buildInvoiceText(order, whatsappLink, content),
      html: buildInvoiceHtml(order, whatsappLink, content),
    });
    console.log(
      `[notify] Email invoice terkirim ke ${toEmail} (messageId: ${info.messageId})`,
    );
    return { ok: true };
  } catch (err) {
    // Sengaja tidak di-throw ulang: kegagalan kirim notifikasi TIDAK BOLEH
    // menggagalkan proses checkout / pembayaran.
    const reason = explainSmtpError(err);
    console.error(
      `[notify] Gagal mengirim email invoice ke ${toEmail} — ${reason}`,
      "\n[notify] Detail teknis:",
      err.code || "",
      err.response || err.message,
    );
    return { ok: false, reason };
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
    const content = await getMergedContent().catch(() => null);
    const target = normalizePhoneToWhatsapp(order.phone);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: process.env.FONNTE_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        target,
        message: buildInvoiceText(order, null, content),
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

    const waUrl = buildAdminFollowUpWaUrl(order);

    const text = `Halo Admin Optik Kayumanis,

Ada PESANAN BARU yang masuk ke sistem:

No. Pesanan : ${order.orderNumber}
Pemesan     : ${order.recipientName} (${order.phone})
Total       : ${formatRupiah(order.total)}

Rincian Produk:
${itemLines}

Alamat Pengiriman:
${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}

Silakan cek panel admin di /admin/orders untuk memproses pesanan ini.${
      waUrl ? `\n\nChat langsung ke customer via WhatsApp:\n${waUrl}` : ""
    }`;

    const itemRowsHtml = order.items
      .map(
        (i) =>
          `<tr><td style="padding:4px 0;color:#334155;">${i.name} × ${i.quantity}</td><td style="padding:4px 0;text-align:right;color:#334155;">${formatRupiah(i.price * i.quantity)}</td></tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
        <p>Halo Admin Optik Kayumanis,</p>
        <p><strong>Ada PESANAN BARU</strong> yang masuk ke sistem:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
          <tr><td style="padding:4px 0;color:#64748b;">No. Pesanan</td><td style="padding:4px 0;text-align:right;">${order.orderNumber}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Pemesan</td><td style="padding:4px 0;text-align:right;">${order.recipientName} (${order.phone})</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">Total</td><td style="padding:4px 0;text-align:right;font-weight:bold;">${formatRupiah(order.total)}</td></tr>
        </table>
        <p style="margin:16px 0 4px;font-weight:bold;">Rincian Produk:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRowsHtml}</table>
        <p style="margin:16px 0 4px;font-weight:bold;">Alamat Pengiriman:</p>
        <p style="margin:0;font-size:14px;color:#334155;">${order.shippingAddress}, ${order.city}, ${order.province} ${order.postalCode}</p>
        ${
          waUrl
            ? `<div style="margin:24px 0;">
                <a href="${waUrl}" target="_blank" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:8px;">
                  💬 Chat Customer via WhatsApp
                </a>
              </div>`
            : ""
        }
        <p style="font-size:13px;color:#64748b;">Silakan cek panel admin di <strong>/admin/orders</strong> untuk memproses pesanan ini.</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: adminEmail,
      subject: `🔔 [Pesanan Baru] ${order.orderNumber} - ${order.recipientName}`,
      text,
      html,
    });
    console.log(`[notify] Notifikasi pesanan baru terkirim ke Admin (${adminEmail})`);
  } catch (err) {
    console.error("[notify] Gagal mengirim email pesanan baru ke Admin:", err.message);
  }
}

async function sendOrderInvoiceNotifications(order, user) {
  const [invoiceResult] = await Promise.allSettled([
    sendInvoiceEmail(order, user?.email),
    sendAdminOrderAlert(order),
    // sendInvoiceWhatsapp(order),
  ]);
  return invoiceResult.status === "fulfilled" ? invoiceResult.value : { ok: false, reason: invoiceResult.reason?.message };
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

module.exports = { sendOrderInvoiceNotifications, sendInvoiceEmail, sendLicenseExpiredNotification };
