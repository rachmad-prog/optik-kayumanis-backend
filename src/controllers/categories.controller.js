const slugify = require("slugify");
const prisma = require("../config/db");

const { getProxyBaseUrl, normalizeR2Urls } = require("../utils/normalizeUrl");

async function listCategories(req, res) {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  const proxyBaseUrl = getProxyBaseUrl(req);
  res.json({ items: normalizeR2Urls(categories, proxyBaseUrl) });
}

async function createCategory(req, res) {
  const { name, imageUrl } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: "Nama kategori minimal 2 karakter." });
  }
  const slug = slugify(name, { lower: true, strict: true });
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return res.status(409).json({ message: "Kategori sudah ada." });

  const category = await prisma.category.create({
    data: { name, slug, imageUrl: imageUrl || null },
  });
  const proxyBaseUrl = getProxyBaseUrl(req);
  res.status(201).json({ category: normalizeR2Urls(category, proxyBaseUrl) });
}

// Lets admins set/replace the catalog image for a category (uploaded manually,
// independent of any product photo). Also allows renaming without touching the image.
async function updateCategory(req, res) {
  const { name, imageUrl } = req.body;
  const data = {};

  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Kategori tidak ditemukan." });

  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Nama kategori minimal 2 karakter." });
    }
    data.name = name;
    data.slug = slugify(name, { lower: true, strict: true });
  }
  if (imageUrl !== undefined) {
    // Jika gambar kategori diganti/dihapus, hapus file lama dari R2
    if (existing.imageUrl && existing.imageUrl !== imageUrl) {
      await deleteR2Files(existing.imageUrl);
    }
    data.imageUrl = imageUrl || null;
  }

  try {
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    const proxyBaseUrl = getProxyBaseUrl(req);
    res.json({ category: normalizeR2Urls(category, proxyBaseUrl) });
  } catch {
    res.status(404).json({ message: "Kategori tidak ditemukan." });
  }
}

async function deleteCategory(req, res) {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Kategori tidak ditemukan." });

  const inUse = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (inUse > 0) {
    return res.status(400).json({ message: "Kategori masih dipakai produk lain." });
  }

  if (existing.imageUrl) {
    await deleteR2Files(existing.imageUrl);
  }

  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ message: "Kategori dihapus." });
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
