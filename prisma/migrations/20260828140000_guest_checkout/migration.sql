-- Guest checkout: pesanan boleh dibuat tanpa akun (userId nullable),
-- dan menyimpan email guest untuk invoice/pelacakan pesanan.

-- Drop existing FK constraint on Order.userId (name may vary; adjust if needed)
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";

-- Make userId nullable
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;

-- Add guestEmail column
ALTER TABLE "Order" ADD COLUMN "guestEmail" TEXT;

-- Recreate FK, now allowing NULL userId
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
