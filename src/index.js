require("dotenv").config();
require("express-async-errors"); // patches Express 4 so async route handler errors reach the error middleware below, instead of hanging the request forever
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/products.routes");
const categoryRoutes = require("./routes/categories.routes");
const orderRoutes = require("./routes/orders.routes");
const adminRoutes = require("./routes/admin.routes");
const contentRoutes = require("./routes/content.routes");
const uploadsRoutes = require("./routes/uploads.routes");
const usersRoutes = require("./routes/users.routes");

// ... import/require lainnya ...
const licenseRouter = require("./routes/license"); // 1. Hubungkan file route baru

const app = express();

// Allow images to be embedded/loaded cross-origin (frontend runs on a different port/domain)
// app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "https://optik-kayumanis-frontend.vercel.app/",
//     credentials: true,
//   }),
// );

// Ambil variabel dari .env
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim().replace(/\/$/, ""))
  : ["https://optik-kayumanis-frontend.vercel.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Izinkan jika origin ada di daftar atau jika request tidak memiliki origin (misal: tools server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(morgan("dev"));

app.use(express.json());

// Catatan: gambar produk kini disimpan di Cloudflare R2 (lihat src/config/r2.js),
// jadi static serving folder lokal /uploads sudah tidak diperlukan lagi.

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "optikkayumanis-api" }),
);

// ... middleware app.use lainnya ...
app.use("/api/license", licenseRouter); // 2. Daftarkan path URL api

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/users", usersRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/uploads", uploadsRoutes);

// 404
app.use((req, res) =>
  res.status(404).json({ message: "Endpoint tidak ditemukan." }),
);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === "P2002") {
    return res
      .status(409)
      .json({ message: "Data sudah ada (duplikat), tidak bisa disimpan." });
  }
  if (err.code === "P2003") {
    return res
      .status(400)
      .json({
        message:
          "Data ini masih terhubung dengan data lain dan tidak bisa dihapus/diubah.",
      });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Data tidak ditemukan." });
  }

  res
    .status(err.status || 500)
    .json({ message: err.message || "Terjadi kesalahan pada server." });
});

const PORT = process.env.PORT || 4000;

// Vercel (@vercel/node) imports this file and calls the exported app/handler directly —
// it does NOT run app.listen(). Only listen when running locally / on a normal Node host.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(
      `Optik Kayumanis API berjalan di http://localhost:${PORT}`,
    );
  });
}

module.exports = app;
