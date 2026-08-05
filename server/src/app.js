const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { getPool, pingDatabase } = require("./db");
const { loginAdmin, loginCreator, requireAdmin, requireCreator } = require("./auth");

const app = express();
const staticRoot = path.resolve(__dirname, "../..");

app.use(cors());
app.use(express.json({ limit: "16mb" }));

function toTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapContent(row) {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    creatorId: row.creator_id,
    type: row.mode === "link" ? "网址 / 文字" : row.mode === "sensitive" ? "密码文字" : row.mode === "dual" ? "双图" : "图片",
    mode: row.mode,
    price: Number(row.price),
    rule: row.access_rule,
    status: { pending: "待审核", approved: "已通过", rejected: "已驳回", unpublished: "已下架", draft: "草稿" }[row.status] || row.status,
    risk: { low: "低风险", review: "需复核", high: "高风险" }[row.risk_level] || row.risk_level,
    submitted: toTime(row.submitted_at),
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    contents: Number(row.content_count || 0),
    revenue: Number(row.revenue || 0),
    lastActive: toTime(row.last_active_at),
    status: row.status === "suspended" ? "限制中" : row.status === "pending" ? "待认证" : "正常",
  };
}

function mapOrder(row) {
  return {
    id: row.order_no,
    buyer: row.buyer_name,
    content: row.content_title,
    creator: row.creator,
    amount: Number(row.amount),
    status: { paid: "已支付", settled: "已结算", refunded: "已退款", pending: "待支付", failed: "失败" }[row.status] || row.status,
    time: toTime(row.created_at),
  };
}

const modeLabels = { image: "图片", dual: "双图", link: "网址 / 文字", sensitive: "密码文字" };
const ruleLabels = { window: "支付后可查看", once: "仅查看一次", two_hours: "2 小时有效", "two-hours": "2 小时有效" };

function toDbRule(value) {
  return value === "two-hours" ? "two_hours" : ["window", "once", "two_hours"].includes(value) ? value : "window";
}

function toDataUrl(buffer, mimeType) {
  return buffer ? `data:${mimeType || "application/octet-stream"};base64,${Buffer.from(buffer).toString("base64")}` : "";
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const data = Buffer.from(match[2], "base64");
  if (!data.length) return null;
  return { mimeType: match[1], data };
}

function randomId(prefix) {
  return `${prefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
}

async function getContentAssets(contentId, includeOriginal = false) {
  const [rows] = await getPool().query("SELECT slot, original_blob, preview_blob, mime_type FROM content_assets WHERE content_id = ? ORDER BY slot", [contentId]);
  return rows.reduce((result, row) => {
    const item = { slot: row.slot, mimeType: row.mime_type || "image/jpeg", previewData: toDataUrl(row.preview_blob, row.mime_type) };
    if (includeOriginal) item.originalData = toDataUrl(row.original_blob, row.mime_type);
    result[row.slot] = item;
    return result;
  }, {});
}

function mapCreatorContent(row, assets = {}, includeSecrets = true) {
  const result = {
    id: row.id,
    title: row.title,
    mode: row.mode,
    price: Number(row.price),
    rule: row.access_rule,
    ruleLabel: ruleLabels[row.access_rule] || row.access_rule,
    note: row.note || "",
    linkContent: row.link_content || "",
    textContent: row.text_content || "",
    status: row.status,
    type: modeLabels[row.mode] || row.mode,
    publishedAt: toTime(row.published_at),
    submittedAt: toTime(row.submitted_at),
    updatedAt: toTime(row.updated_at),
    images: assets,
  };
  if (includeSecrets) result.sensitiveText = row.sensitive_text || "";
  return result;
}

function mapPublicContent(row, assets) {
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    type: modeLabels[row.mode] || row.mode,
    price: Number(row.price),
    rule: row.access_rule,
    ruleLabel: ruleLabels[row.access_rule] || row.access_rule,
    note: row.note || "",
    creator: row.creator,
    previewImages: Object.fromEntries(Object.entries(assets).map(([slot, item]) => [slot, { slot, mimeType: item.mimeType, previewData: item.previewData }])),
  };
}

async function saveAssets(executor, contentId, images = {}) {
  for (const slot of ["primary", "secondary"]) {
    const item = images[slot] || {};
    const original = parseDataUrl(item.originalData || item.data || "");
    const preview = parseDataUrl(item.previewData || item.preview || "");
    if (!original && !preview) continue;
    const mimeType = original?.mimeType || preview?.mimeType || "image/jpeg";
    await executor.query("INSERT INTO content_assets (content_id, slot, original_blob, preview_blob, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE original_blob = VALUES(original_blob), preview_blob = VALUES(preview_blob), mime_type = VALUES(mime_type), file_size = VALUES(file_size)", [contentId, slot, original?.data || null, preview?.data || null, mimeType, original?.data?.length || null]);
  }
}

async function createAccessGrant(connection, orderId, contentId, rule) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = rule === "two_hours" ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null;
  await connection.query("INSERT INTO access_grants (order_id, content_id, token_hash, expires_at) VALUES (?, ?, ?, ?)", [orderId, contentId, tokenHash, expires]);
  return { token, expiresAt: expires ? expires.toISOString() : null };
}

async function findAccessGrant(token) {
  const tokenHash = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const [rows] = await getPool().query("SELECT g.id AS grant_id, g.expires_at, o.order_no, c.* FROM access_grants g JOIN orders o ON o.id = g.order_id JOIN contents c ON c.id = g.content_id WHERE g.token_hash = ? AND o.status IN ('paid', 'settled') LIMIT 1", [tokenHash]);
  const grant = rows[0];
  if (!grant || (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now())) return null;
  return grant;
}

async function writeAudit(req, action, resourceType, resourceId, metadata = {}) {
  await getPool().query("INSERT INTO audit_logs (admin_user_id, action, resource_type, resource_id, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?)", [Number(req.admin.sub), action, resourceType, resourceId || null, JSON.stringify(metadata), req.ip]);
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get("/api/health", asyncRoute(async (req, res) => {
  let database = "down";
  try { await pingDatabase(); database = "up"; } catch (error) { /* health still returns server status */ }
  res.status(database === "up" ? 200 : 503).json({ service: "lumen-pass-api", database, timestamp: new Date().toISOString() });
}));

app.post("/api/admin/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "INVALID_INPUT", message: "请输入管理员邮箱和密码" });
  const result = await loginAdmin(email, password);
  if (!result) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "管理员邮箱或密码不正确" });
  res.json(result);
}));

app.post("/api/creator/auth/login", asyncRoute(async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "INVALID_INPUT", message: "请输入创作者邮箱和密码" });
  const result = await loginCreator(email, password);
  if (!result) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "创作者邮箱或密码不正确" });
  res.json(result);
}));

app.get("/api/public/contents/:id", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT c.*, u.display_name AS creator FROM contents c JOIN creator_users u ON u.id = c.creator_id WHERE c.id = ? AND c.status = 'approved' LIMIT 1", [req.params.id]);
  const content = rows[0];
  if (!content) return res.status(404).json({ error: "NOT_FOUND", message: "公开内容不存在或尚未发布" });
  res.json(mapPublicContent(content, await getContentAssets(content.id)));
}));

app.post("/api/public/contents/:id/checkout", asyncRoute(async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query("SELECT id, creator_id, title, price, access_rule, status FROM contents WHERE id = ? AND status = 'approved' LIMIT 1", [req.params.id]);
  const content = rows[0];
  if (!content) return res.status(404).json({ error: "NOT_FOUND", message: "公开内容不存在或尚未发布" });
  const buyerName = String(req.body?.buyerName || "当前访客").trim().slice(0, 100) || "当前访客";
  const buyerEmail = String(req.body?.buyerEmail || "").trim().slice(0, 190) || null;
  const orderNo = randomId("LP");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [order] = await connection.query("INSERT INTO orders (order_no, content_id, creator_id, buyer_name, buyer_email, amount, payment_provider, status, paid_at, access_expires_at) VALUES (?, ?, ?, ?, ?, ?, 'mock', 'paid', UTC_TIMESTAMP(), IF(? = 'two_hours', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR), NULL))", [orderNo, content.id, content.creator_id, buyerName, buyerEmail, content.price, content.access_rule]);
    const access = await createAccessGrant(connection, order.insertId, content.id, content.access_rule);
    await connection.commit();
    res.status(201).json({ orderNo, amount: Number(content.price), status: "paid", accessToken: access.token, expiresAt: access.expiresAt });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get("/api/public/access/:token", asyncRoute(async (req, res) => {
  const grant = await findAccessGrant(req.params.token);
  if (!grant) return res.status(410).json({ error: "ACCESS_EXPIRED", message: "访问授权不存在或已过期" });
  const assets = await getContentAssets(grant.id, true);
  res.json({
    id: grant.id,
    title: grant.title,
    mode: grant.mode,
    price: Number(grant.price),
    rule: grant.access_rule,
    note: grant.note || "",
    linkContent: grant.link_content || "",
    textContent: grant.text_content || "",
    sensitiveText: grant.sensitive_text || "",
    images: assets,
    orderNo: grant.order_no,
    expiresAt: grant.expires_at ? toTime(grant.expires_at) : null,
  });
}));

app.get("/api/public/access/:token/download/:slot", asyncRoute(async (req, res) => {
  const grant = await findAccessGrant(req.params.token);
  if (!grant) return res.status(410).json({ error: "ACCESS_EXPIRED", message: "访问授权不存在或已过期" });
  if (!["primary", "secondary"].includes(req.params.slot)) return res.status(400).json({ error: "INVALID_SLOT", message: "图片位置无效" });
  const [rows] = await getPool().query("SELECT original_blob, mime_type FROM content_assets WHERE content_id = ? AND slot = ? LIMIT 1", [grant.id, req.params.slot]);
  const asset = rows[0];
  if (!asset?.original_blob) return res.status(404).json({ error: "NOT_FOUND", message: "原图不存在" });
  res.setHeader("Content-Type", asset.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename=\"${grant.id}-${req.params.slot}.jpg\"`);
  res.send(asset.original_blob);
}));

app.post("/api/public/contents/:id/report", asyncRoute(async (req, res) => {
  const reason = String(req.body?.reason || "其他问题").trim().slice(0, 255);
  const detail = String(req.body?.detail || "").trim().slice(0, 2000) || null;
  await getPool().query("INSERT INTO reports (content_id, reporter_name, reason, detail, priority, status) VALUES (?, ?, ?, ?, 'normal', 'open')", [req.params.id, String(req.body?.reporterName || "访客").trim().slice(0, 100), reason, detail]);
  res.status(201).json({ ok: true });
}));

app.use("/api/creator", requireCreator);

app.get("/api/creator/me", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT id, email, display_name, bio, status FROM creator_users WHERE id = ? LIMIT 1", [Number(req.creator.sub)]);
  if (!rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "创作者不存在" });
  res.json({ id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name, bio: rows[0].bio || "", status: rows[0].status });
}));

app.get("/api/creator/contents", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT * FROM contents WHERE creator_id = ? ORDER BY submitted_at DESC", [Number(req.creator.sub)]);
  const items = await Promise.all(rows.map(async (row) => mapCreatorContent(row, await getContentAssets(row.id), true)));
  res.json({ items });
}));

app.post("/api/creator/contents", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const mode = String(body.mode || "image");
  const title = String(body.title || "").trim().slice(0, 160);
  const price = Number(body.price);
  if (!Object.keys(modeLabels).includes(mode) || !title || !Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "INVALID_INPUT", message: "内容模式、标题和价格不能为空" });
  const id = randomId("PC");
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("INSERT INTO contents (id, creator_id, title, mode, price, access_rule, note, link_content, text_content, sensitive_text, status, risk_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'low')", [id, Number(req.creator.sub), title, mode, price, toDbRule(String(body.rule || "window")), String(body.note || "").trim(), String(body.linkContent || "").trim() || null, String(body.textContent || "").trim() || null, String(body.sensitiveText || "").trim() || null]);
    await saveAssets(connection, id, body.images || {});
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json({ id, status: "pending" });
}));

app.patch("/api/creator/contents/:id", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const [owned] = await getPool().query("SELECT id FROM contents WHERE id = ? AND creator_id = ? LIMIT 1", [req.params.id, Number(req.creator.sub)]);
  if (!owned[0]) return res.status(404).json({ error: "NOT_FOUND", message: "内容不存在" });
  const fields = [];
  const values = [];
  for (const [column, value] of [["title", body.title], ["price", body.price], ["note", body.note], ["link_content", body.linkContent], ["text_content", body.textContent], ["sensitive_text", body.sensitiveText]]) {
    if (value !== undefined) { fields.push(`${column} = ?`); values.push(column === "price" ? Number(value) : String(value || "").trim() || null); }
  }
  if (body.mode) { fields.push("mode = ?"); values.push(String(body.mode)); }
  if (body.rule) { fields.push("access_rule = ?"); values.push(toDbRule(String(body.rule))); }
  if (fields.length) { fields.push("status = 'pending'"); values.push(req.params.id, Number(req.creator.sub)); await getPool().query(`UPDATE contents SET ${fields.join(", ")} WHERE id = ? AND creator_id = ?`, values); }
  if (body.images) await saveAssets(getPool(), req.params.id, body.images);
  res.json({ ok: true, id: req.params.id, status: "pending" });
}));

app.use("/api/admin", requireAdmin);

app.get("/api/admin/overview", asyncRoute(async (req, res) => {
  const pool = getPool();
  const [[gmv]] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS value, COUNT(*) AS order_count FROM orders WHERE status IN ('paid', 'settled') AND created_at >= UTC_DATE()");
  const [[creators]] = await pool.query("SELECT COUNT(*) AS value FROM creator_users WHERE status = 'active'");
  const [[pendingContents]] = await pool.query("SELECT COUNT(*) AS value FROM contents WHERE status = 'pending'");
  const [[openReports]] = await pool.query("SELECT COUNT(*) AS value FROM reports WHERE status IN ('open', 'processing')");
  const [activity] = await pool.query("SELECT action, resource_type, resource_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8");
  res.json({ gmv: Number(gmv.value), orderCount: Number(gmv.order_count), activeCreators: Number(creators.value), pendingContents: Number(pendingContents.value), openReports: Number(openReports.value), activity: activity.map((item) => ({ ...item, created_at: toTime(item.created_at) })) });
}));

app.get("/api/admin/contents", asyncRoute(async (req, res) => {
  const pool = getPool();
  const filters = [];
  const values = [];
  if (req.query.status && ["pending", "approved", "rejected", "unpublished"].includes(String(req.query.status))) { filters.push("c.status = ?"); values.push(req.query.status); }
  if (req.query.q) { filters.push("(c.title LIKE ? OR u.display_name LIKE ? OR c.id LIKE ?)"); const query = `%${String(req.query.q)}%`; values.push(query, query, query); }
  const [rows] = await pool.query(`SELECT c.id, c.title, c.mode, c.price, c.access_rule, c.status, c.risk_level, c.submitted_at, c.creator_id, u.display_name AS creator FROM contents c JOIN creator_users u ON u.id = c.creator_id ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY c.submitted_at DESC`, values);
  res.json({ items: rows.map(mapContent) });
}));

app.patch("/api/admin/contents/:id/status", asyncRoute(async (req, res) => {
  const status = String(req.body?.status || "");
  const allowed = ["pending", "approved", "rejected", "unpublished"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "INVALID_STATUS", message: "不支持的内容状态" });
  const [result] = await getPool().query("UPDATE contents SET status = ?, published_at = IF(? = 'approved', COALESCE(published_at, UTC_TIMESTAMP()), NULL) WHERE id = ?", [status, status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "NOT_FOUND", message: "内容不存在" });
  await writeAudit(req, `content.${status}`, "content", req.params.id, { status });
  res.json({ ok: true, id: req.params.id, status });
}));

app.get("/api/admin/users", asyncRoute(async (req, res) => {
  const values = [];
  let where = "";
  if (req.query.q) { where = "WHERE u.display_name LIKE ? OR u.email LIKE ?"; const query = `%${String(req.query.q)}%`; values.push(query, query); }
  const [rows] = await getPool().query(`SELECT u.id, u.display_name, u.email, u.status, u.last_active_at, COUNT(DISTINCT c.id) AS content_count, COALESCE(SUM(CASE WHEN o.status IN ('paid', 'settled') THEN o.amount ELSE 0 END), 0) AS revenue FROM creator_users u LEFT JOIN contents c ON c.creator_id = u.id LEFT JOIN orders o ON o.creator_id = u.id ${where} GROUP BY u.id ORDER BY u.last_active_at DESC`, values);
  res.json({ items: rows.map(mapUser) });
}));

app.patch("/api/admin/users/:id/status", asyncRoute(async (req, res) => {
  const status = String(req.body?.status || "");
  if (!["active", "suspended"].includes(status)) return res.status(400).json({ error: "INVALID_STATUS", message: "不支持的账号状态" });
  const [result] = await getPool().query("UPDATE creator_users SET status = ? WHERE id = ?", [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "NOT_FOUND", message: "创作者不存在" });
  await writeAudit(req, `creator.${status}`, "creator", req.params.id, { status });
  res.json({ ok: true, id: req.params.id, status });
}));

app.get("/api/admin/orders", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT o.order_no, o.buyer_name, o.amount, o.status, o.created_at, c.title AS content_title, u.display_name AS creator FROM orders o JOIN contents c ON c.id = o.content_id JOIN creator_users u ON u.id = o.creator_id ORDER BY o.created_at DESC LIMIT 100");
  res.json({ items: rows.map(mapOrder) });
}));

app.get("/api/admin/settings", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT setting_key, setting_value, value_type, description FROM platform_settings ORDER BY setting_key");
  res.json({ items: rows.map((row) => ({ key: row.setting_key, value: row.value_type === "boolean" ? row.setting_value === "true" : row.setting_value, type: row.value_type, description: row.description })) });
}));

app.patch("/api/admin/settings/:key", asyncRoute(async (req, res) => {
  const value = req.body?.value;
  if (typeof value !== "boolean") return res.status(400).json({ error: "INVALID_VALUE", message: "平台开关必须是布尔值" });
  const [result] = await getPool().query("UPDATE platform_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?", [String(value), Number(req.admin.sub), req.params.key]);
  if (!result.affectedRows) return res.status(404).json({ error: "NOT_FOUND", message: "平台设置不存在" });
  await writeAudit(req, "setting.update", "platform_setting", req.params.key, { value });
  res.json({ ok: true, key: req.params.key, value });
}));

app.get("/api/admin/audit-logs", asyncRoute(async (req, res) => {
  const [rows] = await getPool().query("SELECT l.id, l.action, l.resource_type, l.resource_id, l.metadata, l.created_at, a.display_name AS admin_name FROM audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_user_id ORDER BY l.created_at DESC LIMIT 100");
  res.json({ items: rows.map((row) => ({ ...row, created_at: toTime(row.created_at) })) });
}));

app.use(express.static(staticRoot));
app.get(["/admin", "/p/:id"], (req, res) => res.sendFile(path.join(staticRoot, "index.html")));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "服务暂时不可用" });
});

module.exports = app;
