const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const BLOB_CHUNK_BYTES = 512 * 1024;
const BLOB_COLUMNS = new Set(["original_blob", "preview_blob"]);

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

async function writeBlobInChunks(executor, { contentId, slot, column, data }) {
  if (!BLOB_COLUMNS.has(column)) throw new Error("Unsupported content asset column");
  if (!Buffer.isBuffer(data) || !data.length) throw new Error("Content asset data is required");
  await executor.execute(`UPDATE content_assets SET ${column} = ? WHERE content_id = ? AND slot = ?`, [Buffer.alloc(0), contentId, slot]);
  for (let offset = 0; offset < data.length; offset += BLOB_CHUNK_BYTES) {
    const chunk = data.subarray(offset, Math.min(offset + BLOB_CHUNK_BYTES, data.length));
    await executor.execute(`UPDATE content_assets SET ${column} = CONCAT(${column}, ?) WHERE content_id = ? AND slot = ?`, [chunk, contentId, slot]);
  }
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  BLOB_CHUNK_BYTES,
  MAX_IMAGE_BYTES,
  extensionForMimeType,
  getDeliveryIssue,
  parseImageDataUrl,
  requiredAssetSlots,
  writeBlobInChunks,
};
