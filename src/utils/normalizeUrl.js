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

module.exports = { getProxyBaseUrl, normalizeR2Urls };
