const crypto = require("crypto");

// Berapa lama token konfirmasi (bukan masa aktif website) berlaku sebelum harus digenerate ulang.
// Ini mencegah token lama "bocor" (misal kelihatan di screenshot lama) tetap bisa dipakai kapan saja.
const TOKEN_VALIDITY_MINUTES = 15;

function generatePlainToken() {
  // 24 byte acak -> 48 karakter hex, cukup panjang untuk dianggap aman ditebak
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(plainToken) {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}

module.exports = { generatePlainToken, hashToken, TOKEN_VALIDITY_MINUTES };
