const slugify = require("slugify");
const prisma = require("../config/db");

async function listCategories(req, res) {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  res.json({ items: categories });
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
  res.status(201).json({ category });
}

// Lets admins set/replace the catalog image for a category (uploaded manually,
// independent of any product photo). Also allows renaming without touching the image.
async function updateCategory(req, res) {
  const { name, imageUrl } = req.body;
  const data = {};

  if (name !== undefined) {
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Nama kategori minimal 2 karakter." });
    }
    data.name = name;
    data.slug = slugify(name, { lower: true, strict: true });
  }
  if (imageUrl !== undefined) {
    data.imageUrl = imageUrl || null;
  }

  try {
    const category = await prisma.category.update({ where: { id: req.params.id }, data });
    res.json({ category });
  } catch {
    res.status(404).json({ message: "Kategori tidak ditemukan." });
  }
}

async function deleteCategory(req, res) {
  const inUse = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (inUse > 0) {
    return res.status(400).json({ message: "Kategori masih dipakai produk lain." });
  }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ message: "Kategori dihapus." });
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
