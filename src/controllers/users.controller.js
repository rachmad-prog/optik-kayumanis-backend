const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/db");

function toPublicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

const createSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z.string().optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").optional(),
  email: z.string().email("Email tidak valid").optional(),
  phone: z.string().optional(),
  // DIREKTUR diizinkan di sini supaya update akun Direktur sendiri (mis. ganti password)
  // tidak gagal validasi. Siapa yang boleh benar-benar MENGUBAH role ke DIREKTUR tetap
  // dibatasi lewat pengecekan di updateUser() di bawah.
  role: z.enum(["CUSTOMER", "ADMIN", "DIREKTUR"]).optional(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
});

// GET /api/admin/users?role=&search=
async function listUsers(req, res) {
  const { role, search } = req.query;
  const where = {};
  if (role && ["CUSTOMER", "ADMIN"].includes(role)) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  res.json({ items: users });
}

// GET /api/admin/users/:id
async function getUser(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: "User tidak ditemukan." });
  if (user.role === "DIREKTUR" && req.user.role !== "DIREKTUR") {
    return res.status(404).json({ message: "User tidak ditemukan." });
  }
  res.json({ user: toPublicUser(user) });
}

// POST /api/admin/users — admin creates a new user, optionally as ADMIN (staff account)
async function createUser(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { name, email, password, phone, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ message: "Email sudah terdaftar." });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, phone, role: role || "CUSTOMER" },
  });
  res.status(201).json({ user: toPublicUser(user) });
}

// PUT /api/admin/users/:id — edit profile fields and/or role; password optional
async function updateUser(req, res) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { name, email, phone, role, password } = parsed.data;

  const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!targetUser) return res.status(404).json({ message: "User tidak ditemukan." });

  // Prevent a user from changing their own role (would risk locking themselves out).
  // Compare against their actual current role, not a hardcoded value, so this works
  // for ADMIN and DIREKTUR alike — as long as the role field is left unchanged it's fine.
  if (req.user.id === req.params.id && role && role !== targetUser.role) {
    return res.status(400).json({ message: "Tidak bisa mengubah role akun sendiri." });
  }

  // Only a DIREKTUR may edit another DIREKTUR account (plain ADMIN cannot)
  if (targetUser.role === "DIREKTUR" && req.user.role !== "DIREKTUR") {
    return res.status(403).json({ message: "Tidak diizinkan mengubah akun Direktur." });
  }

  // Only a DIREKTUR may assign the DIREKTUR role to anyone (prevents privilege escalation)
  if (role === "DIREKTUR" && req.user.role !== "DIREKTUR") {
    return res.status(403).json({ message: "Tidak diizinkan memberikan role Direktur." });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  if (password) data.password = await bcrypt.hash(password, 10);

  if (email !== undefined) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ message: "Email sudah dipakai akun lain." });
    }
    data.email = email;
  }

  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ user: toPublicUser(user) });
  } catch {
    res.status(404).json({ message: "User tidak ditemukan." });
  }
}

// DELETE /api/admin/users/:id
async function deleteUser(req, res) {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ message: "Tidak bisa menghapus akun sendiri." });
  }
  const targetUser = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!targetUser) return res.status(404).json({ message: "User tidak ditemukan." });
  if (targetUser.role === "DIREKTUR" && req.user.role !== "DIREKTUR") {
    return res.status(403).json({ message: "Tidak diizinkan menghapus akun Direktur." });
  }
  const ordersCount = await prisma.order.count({ where: { userId: req.params.id } });
  if (ordersCount > 0) {
    return res.status(400).json({ message: "User memiliki riwayat pesanan dan tidak bisa dihapus." });
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: "User dihapus." });
  } catch {
    res.status(404).json({ message: "User tidak ditemukan." });
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
