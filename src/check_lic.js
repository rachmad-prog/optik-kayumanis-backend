const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.license.findFirst().then(function(l) {
  console.log(JSON.stringify(l, null, 2));
  const now = new Date();
  console.log("Sekarang:", now.toISOString());
  if (l) {
    const expired = now.getTime() > new Date(l.expiredAt).getTime();
    console.log("Status lisensi:", expired ? "EXPIRED (kadaluarsa)" : "AKTIF");
    console.log("Kadaluarsa:", new Date(l.expiredAt).toISOString());
  } else {
    console.log("Status lisensi: TIDAK ADA data lisensi di database!");
  }
  return p.$disconnect();
}).catch(function(e) { console.error(e.message); return p.$disconnect(); });
