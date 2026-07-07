const prisma = require("../config/db");

async function dashboardStats(req, res) {
  const [totalProducts, totalOrders, totalUsers, revenueAgg, lowStock, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { in: ["PAID", "PROCESSING", "SHIPPED", "COMPLETED"] } } }),
    prisma.product.findMany({ where: { stock: { lte: 5 } }, select: { id: true, name: true, stock: true }, take: 5 }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  res.json({
    totalProducts,
    totalOrders,
    totalUsers,
    totalRevenue: revenueAgg._sum.total || 0,
    lowStock,
    recentOrders,
  });
}

module.exports = { dashboardStats };
