-- Simpan status pengiriman email invoice ke customer, supaya admin bisa lihat
-- langsung di panel /admin/orders kalau ada yang gagal terkirim, dan bisa
-- kirim ulang tanpa perlu buka log server.

ALTER TABLE "Order" ADD COLUMN "invoiceEmailSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "invoiceEmailError" TEXT;
