const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const slugify = require("slugify");

const prisma = new PrismaClient();

async function main() {
  // Admin account
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@optikkayumanis.com" },
    update: {},
    create: {
      name: "Admin Kayumanis",
      email: "admin@optikkayumanis.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const categories = ["Kacamata Optik", "Kacamata Hitam", "Lensa Kontak", "Aksesoris"];
  const categoryRecords = {};
  for (const name of categories) {
    const slug = slugify(name, { lower: true, strict: true });
    const cat = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    categoryRecords[name] = cat;
  }

  const products = [
    {
      name: "Kayumanis Classic Round",
      description: "Frame bulat klasik dengan sentuhan warna tortoise hangat, terinspirasi dari serat kayu manis. Ringan dan nyaman dipakai seharian.",
      price: 449000,
      compareAtPrice: 599000,
      sku: "OK-RND-001",
      stock: 24,
      category: "Kacamata Optik",
      frameShape: "Round",
      frameMaterial: "Asetat",
      isFeatured: true,
      images: ["https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=800"],
    },
    {
      name: "Kayumanis Square Bold",
      description: "Frame kotak tegas untuk tampilan profesional. Cocok untuk bentuk wajah bulat dan oval.",
      price: 479000,
      sku: "OK-SQR-002",
      stock: 18,
      category: "Kacamata Optik",
      frameShape: "Square",
      frameMaterial: "Titanium",
      isFeatured: true,
      images: ["https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=800"],
    },
    {
      name: "Kayumanis Sunset Aviator",
      description: "Kacamata hitam gaya aviator dengan lensa gradasi oranye kecoklatan, terinspirasi warna senja.",
      price: 399000,
      sku: "OK-AVT-003",
      stock: 30,
      category: "Kacamata Hitam",
      frameShape: "Aviator",
      frameMaterial: "Logam",
      isFeatured: true,
      images: ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800"],
    },
    {
      name: "Kayumanis Cat Eye Amber",
      description: "Cat eye elegan warna amber, dilengkapi lensa anti-UV400 untuk perlindungan maksimal.",
      price: 429000,
      sku: "OK-CAT-004",
      stock: 15,
      category: "Kacamata Hitam",
      frameShape: "Cat Eye",
      frameMaterial: "Asetat",
      images: ["https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800"],
    },
    {
      name: "Kayumanis Daily Lens Clear",
      description: "Lensa kontak harian bening dengan kadar air tinggi, nyaman untuk pemakaian lama.",
      price: 149000,
      sku: "OK-LNS-005",
      stock: 50,
      category: "Lensa Kontak",
      images: ["https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800"],
    },
    {
      name: "Kayumanis Hard Case Wood Edition",
      description: "Case kacamata keras bermotif serat kayu, melindungi kacamata favoritmu dari benturan.",
      price: 89000,
      sku: "OK-ACC-006",
      stock: 40,
      category: "Aksesoris",
      images: ["https://images.unsplash.com/photo-1577803645773-f96470509666?w=800"],
    },
  ];

  for (const p of products) {
    const slug = slugify(`${p.name}-${p.sku}`, { lower: true, strict: true });
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: {
        name: p.name,
        slug,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        sku: p.sku,
        stock: p.stock,
        frameShape: p.frameShape,
        frameMaterial: p.frameMaterial,
        isFeatured: !!p.isFeatured,
        categoryId: categoryRecords[p.category].id,
        images: { create: p.images.map((url, i) => ({ url, position: i })) },
      },
    });
  }

  console.log("Seed selesai. Login admin: admin@optikkayumanis.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
