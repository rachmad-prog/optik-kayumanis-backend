const { PrismaClient } = require("@prisma/client");

// Reuse a single Prisma instance across the app (recommended pattern for Node/Express).
// Also cache it on globalThis so nodemon/hot-reload restarts don't spin up a second
// PrismaClient (and a second pool of DB connections) while the old one is still closing.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

// Make sure connections are released whenever the process exits or nodemon restarts it,
// otherwise low-connection-limit hosts (like free-tier Postgres) run out fast.
async function disconnect() {
  try {
    await prisma.$disconnect();
  } catch (err) {
    // ignore — process is exiting anyway
  }
}

process.once("SIGINT", async () => {
  await disconnect();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  await disconnect();
  process.exit(0);
});
// nodemon sends SIGUSR2 before restarting the process
process.once("SIGUSR2", async () => {
  await disconnect();
  process.kill(process.pid, "SIGUSR2");
});

module.exports = prisma;
