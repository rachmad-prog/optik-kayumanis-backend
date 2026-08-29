const prisma = require("../config/db");

// GET /api/tracking — baca pengaturan tracking (publik, dipakai frontend untuk inject script)
async function getTracking(req, res) {
  const row = await prisma.trackingSettings.findUnique({ where: { id: "main" } });
  res.json({
    tracking: {
      metaPixelId:    row?.metaPixelId    || null,
      googleAdsId:    row?.googleAdsId    || null,
      googleAdsLabel: row?.googleAdsLabel || null,
      gtmId:          row?.gtmId          || null,
      gaId:           row?.gaId           || null,
    },
  });
}

// PUT /api/tracking — simpan pengaturan tracking (hanya DIREKTUR)
async function updateTracking(req, res) {
  const { metaPixelId, googleAdsId, googleAdsLabel, gtmId, gaId } = req.body;

  const row = await prisma.trackingSettings.upsert({
    where: { id: "main" },
    create: {
      id:             "main",
      metaPixelId:    metaPixelId    ? metaPixelId.trim()    : null,
      googleAdsId:    googleAdsId    ? googleAdsId.trim()    : null,
      googleAdsLabel: googleAdsLabel ? googleAdsLabel.trim() : null,
      gtmId:          gtmId          ? gtmId.trim()          : null,
      gaId:           gaId           ? gaId.trim()           : null,
    },
    update: {
      metaPixelId:    metaPixelId    ? metaPixelId.trim()    : null,
      googleAdsId:    googleAdsId    ? googleAdsId.trim()    : null,
      googleAdsLabel: googleAdsLabel ? googleAdsLabel.trim() : null,
      gtmId:          gtmId          ? gtmId.trim()          : null,
      gaId:           gaId           ? gaId.trim()           : null,
    },
  });

  res.json({ tracking: row });
}

module.exports = { getTracking, updateTracking };
