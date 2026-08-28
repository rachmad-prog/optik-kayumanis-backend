-- Pembayaran diganti menjadi transfer bank manual sepenuhnya, kolom terkait
-- Midtrans (Snap token & order id) tidak lagi diperlukan.

-- DropIndex
DROP INDEX IF EXISTS "Order_midtransOrderId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN IF EXISTS "midtransOrderId";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "midtransToken";
