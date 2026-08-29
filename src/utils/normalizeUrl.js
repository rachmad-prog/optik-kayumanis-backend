const { DeleteObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { r2, R2_BUCKET_NAME } = require("../config/r2");

function getProxyBaseUrl(req) {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${protocol}://${host}/api/uploads/file`;
}

function normalizeR2Urls(data, proxyBaseUrl) {
  if (!data || !proxyBaseUrl) return data;
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const normalizedStr = str.replace(/https?:\/\/pub-[a-f0-9]+\.r2\.dev\//gi, `${proxyBaseUrl.replace(/\/+$/, "")}/`);
    return typeof data === "string" ? normalizedStr : JSON.parse(normalizedStr);
  } catch (err) {
    return data;
  }
}

function extractR2Key(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/(?:products\/[^\/\s]+)/i);
  if (match) return match[0];
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/^\/api\/uploads\/file\//, "").replace(/^\//, "");
    return pathname || null;
  } catch {
    return null;
  }
}

async function deleteR2Files(urls) {
  if (!urls) return;
  const urlList = Array.isArray(urls) ? urls : [urls];
  const keys = urlList.map(extractR2Key).filter(Boolean);
  if (!keys.length || !R2_BUCKET_NAME) return;

  try {
    if (keys.length === 1) {
      await r2.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: keys[0],
        })
      );
    } else {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
          },
        })
      );
    }
  } catch (err) {
    console.error("Gagal menghapus file dari Cloudflare R2:", err);
  }
}

function extractAllR2Urls(obj) {
  if (!obj) return [];
  const str = typeof obj === "string" ? obj : JSON.stringify(obj);
  const matches = str.match(/(?:https?:\/\/[^\s"'`]+\/)?products\/[a-zA-Z0-9_.-]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

module.exports = { getProxyBaseUrl, normalizeR2Urls, extractR2Key, extractAllR2Urls, deleteR2Files };
