require("dotenv").config();
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
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin:
      process.env.CLIENT_URL || "https://optik-kayumanis-frontend.vercel.app",
    credentials: true,
  }),
);
app.use(morgan("dev"));

// Midtrans webhook needs raw JSON body too — express.json() is fine, Midtrans posts JSON
app.use(express.json());

// Uploaded product images (see src/middleware/upload.js)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

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
      `Optik Kayumanis API berjalan di https://optik-kayumanis-frontend.vercel.app:${PORT}`,
    );
  });
}

module.exports = app;
