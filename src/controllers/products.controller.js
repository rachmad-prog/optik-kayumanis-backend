const { z } = require("zod");
const slugify = require("slugify");
const prisma = require("../config/db");

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullable().optional(),
  sku: z.string().min(2),
  stock: z.number().int().min(0),
  categoryId: z.string(),
  frameShape: z.string().optional(),
  frameMaterial: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  images: z.array(z.string().url()).optional(),
});

// GET /api/products?category=&q=&featured=&page=&limit=
async function listProducts(req, res) {
  const { category, q, featured, page = "1", limit = "12" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(parseInt(limit, 10) || 12, 50);

  const where = {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(featured === "true" ? { isFeatured: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { images: true, category: true },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    items,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
}

async function getProductBySlug(req, res) {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { images: { orderBy: { position: "asc" } }, category: true },
  });
  if (!product || !product.isActive) {
    return res.status(404).json({ message: "Produk tidak ditemukan." });
  }
  res.json({ product });
}

// --- Admin ---

async function adminGetProduct(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { images: true, category: true },
  });
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
  res.json({ product });
}

async function adminListProducts(req, res) {
  const products = await prisma.product.findMany({
    include: { images: true, category: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ items: products });
}

async function createProduct(req, res) {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { images, ...data } = parsed.data;
  const slug = slugify(`${data.name}-${data.sku}`, { lower: true, strict: true });

  const product = await prisma.product.create({
    data: {
      ...data,
      slug,
      images: images?.length
        ? { create: images.map((url, i) => ({ url, position: i })) }
        : undefined,
    },
    include: { images: true, category: true },
  });
  res.status(201).json({ product });
}

async function updateProduct(req, res) {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { images, ...data } = parsed.data;

  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Produk tidak ditemukan." });

  if (images) {
    await prisma.productImage.deleteMany({ where: { productId: existing.id } });
  }

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...data,
      images: images?.length
        ? { create: images.map((url, i) => ({ url, position: i })) }
        : undefined,
    },
    include: { images: true, category: true },
  });
  res.json({ product });
}

async function deleteProduct(req, res) {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Produk tidak ditemukan." });

  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ message: "Produk dihapus." });
}

module.exports = {
  listProducts,
  getProductBySlug,
  adminGetProduct,
  adminListProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
