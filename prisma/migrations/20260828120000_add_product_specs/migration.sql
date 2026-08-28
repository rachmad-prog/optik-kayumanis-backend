-- Tambahan field spesifikasi produk sesuai permintaan admin:
-- Ukuran (lebar lensa, lebar bridge, panjang gagang) dan Warna.
-- frameShape & frameMaterial sudah ada sebelumnya, sekarang cuma dibatasi
-- ke daftar pilihan tertentu di level aplikasi (form), tidak perlu ubah kolom.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lensWidth" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bridgeWidth" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "templeLength" DOUBLE PRECISION;
