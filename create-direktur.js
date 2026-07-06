const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// Kita gunakan fungsi hash password bawaan utils JWT atau bcrypt project kamu.
// Jika utils kamu menggunakan bcrypt langsung, sesuaikan require-nya.
const bcrypt = require("bcrypt");

async function main() {
  console.log("🚀 Memulai proses pendaftaran akun DIREKTUR...");

  // Data akun Direktur Utama yang ingin didaftarkan (Silakan ganti sesuai kebutuhan)
  const emailDirektur = "direktur@gmail.com";
  const passwordMentah = "DirekturUtama2026!"; // Amankan password ini nanti
  const namaDirektur = "Direktur";

  // 1. Cek apakah email ini sudah terdaftar sebelumnya
  const userExist = await prisma.user.findUnique({
    where: { email: emailDirektur },
  });

  if (userExist) {
    console.log(`⚠️ Akun dengan email ${emailDirektur} sudah ada di database!`);
    return;
  }

  // 2. Hash password mentah agar aman dan terenkripsi di database
  // Menggunakan salt rounds 10 (standar bcrypt)
  const hashedPassword = await bcrypt.hash(passwordMentah, 10);

  // 3. Inject data langsung ke database dengan role DIREKTUR
  const direkturBaru = await prisma.user.create({
    data: {
      name: namaDirektur,
      email: emailDirektur,
      password: hashedPassword,
      role: "DIREKTUR", // 🔑 Mengunci hak akses tertinggi sistem
    },
  });

  console.log("-------------------------------------------------------");
  console.log("🎉 AKUN DIREKTUR BERHASIL DIDAFDARKAN!");
  console.log(`📧 Email   : ${direkturBaru.email}`);
  console.log(`🔑 Password: ${passwordMentah}`);
  console.log(`🛡️ Role    : ${direkturBaru.role}`);
  console.log("-------------------------------------------------------");
  console.log("Silakan gunakan akun ini untuk login di frontend utama.");
}

main()
  .catch((e) => {
    console.error("❌ Gagal membuat akun Direktur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
