const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function parseImageDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ALLOWED_IMAGE_MIME_TYPES.has(match[1].toLowerCase())) return null;
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_IMAGE_BYTES) return null;
  return { mimeType: match[1].toLowerCase(), data };
}

function requiredAssetSlots(mode) {
  if (mode === "image") return ["primary"];
  if (mode === "dual") return ["primary", "secondary"];
  return [];
}

function getDeliveryIssue(content, assetSlots = []) {
  const mode = String(content?.mode || "");
  if (mode === "link" && !String(content?.link_content || content?.linkContent || content?.text_content || content?.textContent || "").trim()) {
    return "网址或文字内容不能为空";
  }
  if (mode === "sensitive" && !String(content?.sensitive_text || content?.sensitiveText || "").trim()) {
    return "密码或授权文字不能为空";
  }
  const existingSlots = new Set(assetSlots);
  const missingSlots = requiredAssetSlots(mode).filter((slot) => !existingSlots.has(slot));
  if (missingSlots.length) return mode === "dual" ? "双图内容必须包含两张原图" : "图片内容必须包含原图";
  return "";
}

function extensionForMimeType(mimeType) {
  return { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" }[String(mimeType || "").toLowerCase()] || "bin";
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  extensionForMimeType,
  getDeliveryIssue,
  parseImageDataUrl,
  requiredAssetSlots,
};
