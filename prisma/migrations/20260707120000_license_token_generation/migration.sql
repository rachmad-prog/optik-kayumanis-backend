-- AlterTable
-- tokenCode sekarang menyimpan HASH dari token konfirmasi (bukan token .env lagi),
-- jadi boleh kosong sebelum Direktur pernah generate token.
ALTER TABLE "License" ALTER COLUMN "tokenCode" DROP NOT NULL;
ALTER TABLE "License" ADD COLUMN "tokenGeneratedAt" TIMESTAMP(3);
ALTER TABLE "License" ADD COLUMN "tokenUsed" BOOLEAN NOT NULL DEFAULT true;

-- Token lama (dari .env) tidak berlaku lagi di sistem baru ini, jadi tandai sebagai "sudah dipakai"
-- supaya tidak ada token basi yang bisa dipakai sebelum Direktur generate token baru.
UPDATE "License" SET "tokenCode" = NULL, "tokenUsed" = true;
