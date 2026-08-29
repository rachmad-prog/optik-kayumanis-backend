const prisma = require("../config/db");

// Buat slug dari judul artikel
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/, "");
}

// Pastikan slug unik — jika ada duplikat, tambahkan suffix -2, -3, dst
async function uniqueSlug(base, excludeId = null) {
  let slug = base;
  let counter = 1;
  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
}

// ─── PUBLIC ─────────────────────────────────────────────────────────────────

// GET /api/articles — list artikel published (publik)
async function listArticles(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const skip  = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.article.count({ where: { isPublished: true } }),
    prisma.article.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, title: true, slug: true,
        excerpt: true, thumbnail: true, publishedAt: true, createdAt: true,
      },
    }),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}

// GET /api/articles/:slug — detail artikel (publik)
async function getArticleBySlug(req, res) {
  const article = await prisma.article.findUnique({
    where: { slug: req.params.slug, isPublished: true },
  });
  if (!article) return res.status(404).json({ message: "Artikel tidak ditemukan." });
  res.json({ article });
}

// ─── ADMIN ──────────────────────────────────────────────────────────────────

// GET /api/articles/admin/all — list semua artikel (admin, termasuk draft)
async function adminListArticles(req, res) {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.article.count(),
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, title: true, slug: true,
        isPublished: true, publishedAt: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}

// GET /api/articles/admin/id/:id — detail artikel by ID (admin)
async function adminGetArticle(req, res) {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ message: "Artikel tidak ditemukan." });
  res.json({ article });
}

// POST /api/articles — buat artikel baru (admin)
async function createArticle(req, res) {
  const { title, excerpt, content, thumbnail, isPublished } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ message: "Judul wajib diisi." });
  if (!content || !content.trim()) return res.status(400).json({ message: "Konten wajib diisi." });

  const baseSlug = slugify(title);
  const slug     = await uniqueSlug(baseSlug);
  const published = Boolean(isPublished);

  const article = await prisma.article.create({
    data: {
      title:       title.trim(),
      slug,
      excerpt:     excerpt ? excerpt.trim() : null,
      content:     content.trim(),
      thumbnail:   thumbnail ? thumbnail.trim() : null,
      isPublished: published,
      publishedAt: published ? new Date() : null,
    },
  });

  res.status(201).json({ article });
}

// PUT /api/articles/:id — edit artikel (admin)
async function updateArticle(req, res) {
  const { title, slug: rawSlug, excerpt, content, thumbnail, isPublished } = req.body;
  const { id } = req.params;

  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Artikel tidak ditemukan." });

  let slug = existing.slug;
  if (rawSlug && rawSlug.trim()) {
    slug = await uniqueSlug(slugify(rawSlug.trim()), id);
  } else if (title && title.trim() && title.trim() !== existing.title) {
    slug = await uniqueSlug(slugify(title.trim()), id);
  }

  const published = isPublished !== undefined ? Boolean(isPublished) : existing.isPublished;
  const publishedAt = published
    ? (existing.publishedAt || new Date())
    : null;

  const article = await prisma.article.update({
    where: { id },
    data: {
      title:       title ? title.trim() : existing.title,
      slug,
      excerpt:     excerpt !== undefined ? (excerpt ? excerpt.trim() : null) : existing.excerpt,
      content:     content ? content.trim() : existing.content,
      thumbnail:   thumbnail !== undefined ? (thumbnail ? thumbnail.trim() : null) : existing.thumbnail,
      isPublished: published,
      publishedAt,
    },
  });

  res.json({ article });
}

// DELETE /api/articles/:id — hapus artikel (admin)
async function deleteArticle(req, res) {
  await prisma.article.delete({ where: { id: req.params.id } });
  res.json({ message: "Artikel berhasil dihapus." });
}

module.exports = {
  listArticles,
  getArticleBySlug,
  adminListArticles,
  adminGetArticle,
  createArticle,
  updateArticle,
  deleteArticle,
};
