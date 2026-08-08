const assert = require("node:assert/strict");
const test = require("node:test");
const { BLOB_CHUNK_BYTES, MAX_IMAGE_BYTES, extensionForMimeType, getDeliveryIssue, parseImageDataUrl, requiredAssetSlots, writeBlobInChunks } = require("../src/content");

test("accepts supported image data URLs and rejects unsafe formats", () => {
  const valid = parseImageDataUrl(`data:image/png;base64,${Buffer.from("png-data").toString("base64")}`);
  assert.equal(valid.mimeType, "image/png");
  assert.equal(valid.data.toString(), "png-data");
  assert.equal(parseImageDataUrl(`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`), null);
  assert.equal(parseImageDataUrl("data:text/html;base64,PGgxPng8L2gxPg=="), null);
});

test("rejects image payloads larger than the upload limit", () => {
  const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64");
  assert.equal(parseImageDataUrl(`data:image/jpeg;base64,${oversized}`), null);
});

test("validates every content delivery mode", () => {
  assert.equal(getDeliveryIssue({ mode: "link", link_content: "" }), "网址或文字内容不能为空");
  assert.equal(getDeliveryIssue({ mode: "link", text_content: "交付文字" }), "");
  assert.equal(getDeliveryIssue({ mode: "sensitive", sensitive_text: "" }), "密码或授权文字不能为空");
  assert.equal(getDeliveryIssue({ mode: "sensitive", sensitive_text: "CODE-123" }), "");
  assert.equal(getDeliveryIssue({ mode: "image" }, []), "图片内容必须包含原图");
  assert.equal(getDeliveryIssue({ mode: "image" }, ["primary"]), "");
  assert.equal(getDeliveryIssue({ mode: "dual" }, ["primary"]), "双图内容必须包含两张原图");
  assert.equal(getDeliveryIssue({ mode: "dual" }, ["primary", "secondary"]), "");
});

test("maps required slots and download extensions", () => {
  assert.deepEqual(requiredAssetSlots("image"), ["primary"]);
  assert.deepEqual(requiredAssetSlots("dual"), ["primary", "secondary"]);
  assert.deepEqual(requiredAssetSlots("link"), []);
  assert.equal(extensionForMimeType("image/png"), "png");
  assert.equal(extensionForMimeType("image/webp"), "webp");
  assert.equal(extensionForMimeType("image/jpeg"), "jpg");
});

test("writes database images in packets below conservative MySQL limits", async () => {
  const calls = [];
  const executor = { execute: async (sql, parameters) => { calls.push({ sql, parameters }); } };
  const data = Buffer.alloc(BLOB_CHUNK_BYTES * 2 + 17, 1);
  await writeBlobInChunks(executor, { contentId: "PC-TEST", slot: "primary", column: "original_blob", data });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].parameters[0].length, 0);
  assert.deepEqual(calls.slice(1).map((call) => call.parameters[0].length), [BLOB_CHUNK_BYTES, BLOB_CHUNK_BYTES, 17]);
  assert.ok(calls.slice(1).every((call) => call.parameters[0].length < 4 * 1024 * 1024));
  await assert.rejects(() => writeBlobInChunks(executor, { contentId: "PC-TEST", slot: "primary", column: "unsafe", data }), /Unsupported/);
});
