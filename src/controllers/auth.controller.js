const bcrypt = require("bcryptjs");
const { z } = require("zod");
const prisma = require("../config/db");
const { signToken } = require("../utils/jwt");

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function toPublicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0].message });
  }
  const { name, email, password, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email sudah terdaftar." });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, phone },
  });

  const token = signToken({ id: user.id, role: user.role });
  res.status(201).json({ user: toPublicUser(user), token });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Email dan password wajib diisi." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Email atau password salah." });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Email atau password salah." });
  }

  const token = signToken({ id: user.id, role: user.role });
  res.json({ user: toPublicUser(user), token });
}

async function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

module.exports = { register, login, me };
