const prisma = require("../config/db");

// Fallback content — used the first time (before any admin edit) and merged
// under whatever the admin has saved, so partial edits never break the shape.
const DEFAULT_CONTENT = {
  hero: {
    topbarLeft: "Periksa Mata Gratis di Setiap Pembelian Frame + Lensa",
    topbarRight: "Buka Setiap Hari · 09.00 – 20.00 WIB",
    slides: [
      {
        image: "",
        tag: "Koleksi Terbaru 2026",
        title: "Lihat Dunia Lebih Jernih, Tampil Lebih Percaya Diri",
        desc: "Frame premium, lensa berkualitas, dan pemeriksaan mata akurat — semua dalam satu tempat terpercaya untuk keluarga Anda.",
        ctaPrimaryLabel: "Lihat Koleksi",
        ctaPrimaryHref: "/shop",
        ctaSecondaryLabel: "Jadwalkan Periksa Mata",
        ctaSecondaryHref: "#layanan",
      },
      {
        image: "",
        tag: "Promo Bulan Ini",
        title: "Gratis Lensa Anti Radiasi untuk Pembelian Frame Pilihan",
        desc: "Nikmati penglihatan nyaman sepanjang hari dengan lensa berkualitas tinggi dari mitra terpercaya kami.",
        ctaPrimaryLabel: "Lihat Koleksi",
        ctaPrimaryHref: "/shop",
        ctaSecondaryLabel: "",
        ctaSecondaryHref: "",
      },
      {
        image: "",
        tag: "Layanan Klinis",
        title: "Periksa Mata Akurat Bersama Optometris Berpengalaman",
        desc: "Pemeriksaan refraksi komputerisasi untuk hasil resep kacamata yang tepat.",
        ctaPrimaryLabel: "Jadwalkan Periksa Mata",
        ctaPrimaryHref: "#layanan",
        ctaSecondaryLabel: "",
        ctaSecondaryHref: "",
      },
    ],
  },
  marquee: [
    "★ Lensa Premium Bergaransi",
    "Pemeriksaan Refraksi Akurat",
    "Garansi Frame Resmi",
    "Konsultasi via WhatsApp",
  ],
  valueProps: {
    eyebrow: "Kenapa Optik Kayumanis",
    title: "Kepercayaan yang Terlihat dari Setiap Detail",
    items: [
      { title: "Lensa Premium", desc: "Bekerja sama dengan brand lensa terpercaya untuk hasil optimal dan tahan lama." },
      { title: "Pemeriksaan Komputer Akurat", desc: "Alat refraksi digital untuk resep kacamata yang presisi sesuai kondisi mata Anda." },
      { title: "Garansi Frame", desc: "Setiap pembelian frame dilengkapi garansi resmi dan layanan purna jual." },
      { title: "Konsultasi Cepat", desc: "Tim kami siap membantu lewat WhatsApp untuk rekomendasi dan pemesanan." },
    ],
  },
  katalog: {
    eyebrow: "Katalog Produk",
    title: "Temukan Gaya yang Cocok untuk Anda",
    linkLabel: "Lihat Semua Produk",
  },
  layanan: {
    eyebrow: "Layanan Spesial",
    title: "Periksa Mata Refraksi Klinis, Gratis untuk Setiap Pembelian",
    description:
      "Optometris berpengalaman kami menggunakan alat digital modern untuk mengukur kondisi mata Anda secara akurat — mulai dari minus, silinder, hingga plus. Hasil pemeriksaan langsung digunakan untuk merekomendasikan lensa yang paling sesuai.",
    bullets: [
      "Pemeriksaan refraksi komputerisasi",
      "Konsultasi pemilihan lensa sesuai aktivitas",
      "Estimasi waktu pemeriksaan 15–20 menit",
    ],
    ctaLabel: "Jadwalkan via WhatsApp",
    media: "",
  },
  tentang: {
    eyebrow: "Tentang Kami",
    title: "Optik Terpercaya untuk Keluarga Indonesia",
    description:
      "Optik Kayumanis hadir untuk memberikan pengalaman berbelanja kacamata yang hangat, personal, dan profesional — menggabungkan kualitas produk premium dengan pelayanan pemeriksaan mata yang akurat.",
    stats: [
      { value: "10+", label: "Tahun Berpengalaman" },
      { value: "15K+", label: "Pelanggan Puas" },
      { value: "50+", label: "Merek Frame" },
    ],
    media: "",
  },
  footer: {
    description: "Kacamata & lensa kontak premium, dengan layanan periksa mata profesional.",
    whatsappDisplay: "0812-3456-7890",
    whatsappLink: "https://wa.me/6281234567890",
    email: "halo@optikkayumanis.com",
    address: "Jl. Kayumanis No. 12, Bogor, Jawa Barat",
    hours: ["Senin – Jumat: 09.00 – 20.00", "Sabtu – Minggu: 10.00 – 18.00"],
    socials: { instagram: "#", facebook: "#", tiktok: "#" },
    mapEmbed: "",
    copyrightText: "Optik Kayumanis. Seluruh hak cipta dilindungi.",
  },
};

// Shallow-per-section deep merge: for every top-level key, if the saved data has
// that key use it, otherwise fall back to default — keeps the shape complete even
// after older/partial saves.
function mergeContent(saved) {
  if (!saved || typeof saved !== "object") return DEFAULT_CONTENT;
  const merged = {};
  for (const key of Object.keys(DEFAULT_CONTENT)) {
    merged[key] = saved[key] !== undefined ? saved[key] : DEFAULT_CONTENT[key];
  }
  return merged;
}

async function getContent(req, res) {
  const row = await prisma.siteContent.findUnique({ where: { id: "main" } });
  res.json({ content: mergeContent(row?.data) });
}

// Deep merge for plain objects so partial/per-section saves (e.g. saving just
// "Topbar" without touching "Hero slides", even though both live under the
// same top-level "hero" key) never wipe out sibling data. Arrays and
// primitives are replaced wholesale — only plain objects are merged deeper.
function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function deepMerge(target, source) {
  if (!isPlainObject(source)) return source;
  const result = { ...(isPlainObject(target) ? target : {}) };
  for (const key of Object.keys(source)) {
    if (isPlainObject(source[key]) && isPlainObject(target?.[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

async function updateContent(req, res) {
  const incoming = req.body || {};
  const existing = await prisma.siteContent.findUnique({ where: { id: "main" } });
  const currentData = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const nextData = deepMerge(currentData, incoming);

  const row = await prisma.siteContent.upsert({
    where: { id: "main" },
    create: { id: "main", data: nextData },
    update: { data: nextData },
  });

  res.json({ content: mergeContent(row.data) });
}

module.exports = { getContent, updateContent, DEFAULT_CONTENT };
