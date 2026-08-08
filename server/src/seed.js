const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { getPool, closeDatabase } = require("./db");

const creators = [
  ["夜航者", "hello@lumenpass.com", "记录光线、城市与被认真对待的内容。", "2026-08-05 17:52:00"],
  ["林间照相馆", "studio@linjian.cn", "城市、人像和自然光摄影。", "2026-08-05 17:46:00"],
  ["远方计划", "hello@farplan.co", "把旅行经验整理成可交付的内容。", "2026-08-05 17:20:00"],
  ["Kite Studio", "team@kite.studio", "独立影像工作室。", "2026-08-05 16:48:00"],
  ["光影实验室", "hello@lightlab.cn", "摄影后期与创作工具。", "2026-08-05 15:10:00"],
];

const contents = [
  ["PC-240805-0108", "摄影师通行码", "密码文字", 18, "once", "待审核", "low", "夜航者"],
  ["PC-240805-0107", "城市黄昏摄影作品集", "image", 29.9, "window", "待审核", "low", "林间照相馆"],
  ["PC-240805-0106", "旅行路线与地图", "link", 9.9, "two_hours", "已通过", "low", "远方计划"],
  ["PC-240805-0105", "夏日人像双图", "dual", 39, "window", "已通过", "low", "Kite Studio"],
  ["PC-240805-0104", "未成年人相关内容", "image", 18, "window", "已驳回", "high", "匿名创作者"],
  ["PC-240805-0103", "摄影后期预设包", "link", 49, "window", "已通过", "low", "光影实验室"],
  ["PC-240805-0102", "私享采访录音", "link", 12, "window", "待审核", "review", "夜航者"],
  ["PC-240805-0101", "春日花园", "image", 15, "window", "已通过", "low", "林间照相馆"],
];

const orders = [
  ["LP-240805-0328", "PC-240805-0107", "林间照相馆", "晚风与鲸", 29.9, "paid", "2026-08-05 17:52:00"],
  ["LP-240805-0327", "PC-240805-0103", "光影实验室", "山止川行", 49, "paid", "2026-08-05 17:38:00"],
  ["LP-240805-0326", "PC-240805-0106", "远方计划", "Echo", 9.9, "settled", "2026-08-05 17:19:00"],
  ["LP-240805-0325", "PC-240805-0105", "Kite Studio", "北岛信物", 39, "refunded", "2026-08-05 16:46:00"],
  ["LP-240805-0324", "PC-240805-0101", "林间照相馆", "三时四刻", 15, "paid", "2026-08-05 16:02:00"],
];

const demoDeliveries = [
  ["PC-240805-0101", "感谢支持这组春日花园作品。", null, null, null],
  ["PC-240805-0102", "付款后可阅读完整采访整理稿。", null, "采访全文：从观察光线开始，建立自己的影像语言。", null],
  ["PC-240805-0103", "付款后可打开预设包领取页面。", "https://example.com/lumen-presets", null, null],
  ["PC-240805-0104", "该内容当前不可公开访问。", null, null, null],
  ["PC-240805-0105", "感谢支持这组夏日人像双图。", null, null, null],
  ["PC-240805-0106", "付款后可查看完整旅行路线。", null, "三日旅行路线：第一天旧城，第二天山谷，第三天湖畔。", null],
  ["PC-240805-0107", "感谢支持城市黄昏摄影作品集。", null, null, null],
  ["PC-240805-0108", "授权文字仅在本次安全会话中展示。", null, null, "LUMEN-DEMO-2026\n授权码：N8QF-72KX-PA4M"],
];

const demoImageSlots = new Map([
  ["PC-240805-0101", ["primary"]],
  ["PC-240805-0104", ["primary"]],
  ["PC-240805-0105", ["primary", "secondary"]],
  ["PC-240805-0107", ["primary"]],
]);

async function run() {
  const pool = getPool();
  const creatorPasswordHash = await bcrypt.hash("creator123", 10);
  for (const [name, email, bio, lastActive] of creators) {
    await pool.query("INSERT INTO creator_users (display_name, email, password_hash, bio, status, verified_at, last_active_at) VALUES (?, ?, ?, ?, 'active', UTC_TIMESTAMP(), ?) ON DUPLICATE KEY UPDATE email = VALUES(email)", [name, email, creatorPasswordHash, bio, lastActive]);
  }
  const [creatorRows] = await pool.query("SELECT id, display_name FROM creator_users");
  const creatorMap = new Map(creatorRows.map((row) => [row.display_name, row.id]));
  const statusMap = { 待审核: "pending", 已通过: "approved", 已驳回: "rejected" };
  const modeMap = { 图片: "image", 双图: "dual", "网址 / 文字": "link", 密码文字: "sensitive" };
  const riskMap = { low: "low", review: "review", high: "high" };
  for (const [id, title, mode, price, rule, status, risk, creator] of contents) {
    await pool.query("INSERT INTO contents (id, creator_id, title, mode, price, access_rule, status, risk_level, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'approved', UTC_TIMESTAMP(), NULL)) ON DUPLICATE KEY UPDATE id = VALUES(id)", [id, creatorMap.get(creator) || creatorMap.get("夜航者"), title, modeMap[mode] || mode, price, rule, statusMap[status], riskMap[risk], status]);
  }
  for (const [id, note, linkContent, textContent, sensitiveText] of demoDeliveries) {
    await pool.query("UPDATE contents SET note = COALESCE(NULLIF(note, ''), ?), link_content = COALESCE(NULLIF(link_content, ''), ?), text_content = COALESCE(NULLIF(text_content, ''), ?), sensitive_text = COALESCE(NULLIF(sensitive_text, ''), ?) WHERE id = ?", [note, linkContent, textContent, sensitiveText, id]);
  }
  const originalImage = fs.readFileSync(path.resolve(__dirname, "../../assets/unlocked-preview.png"));
  const previewImage = fs.readFileSync(path.resolve(__dirname, "../../assets/locked-preview.png"));
  for (const [contentId, slots] of demoImageSlots) {
    for (const slot of slots) {
      await pool.query("INSERT INTO content_assets (content_id, slot, original_blob, preview_blob, mime_type, file_size) VALUES (?, ?, ?, ?, 'image/png', ?) ON DUPLICATE KEY UPDATE original_blob = COALESCE(original_blob, VALUES(original_blob)), preview_blob = COALESCE(preview_blob, VALUES(preview_blob)), mime_type = COALESCE(mime_type, VALUES(mime_type)), file_size = COALESCE(file_size, VALUES(file_size))", [contentId, slot, originalImage, previewImage, originalImage.length]);
    }
  }
  const contentRows = await pool.query("SELECT id, creator_id FROM contents").then(([rows]) => rows);
  const contentMap = new Map(contentRows.map((row) => [row.id, row.creator_id]));
  for (const [orderNo, contentId, creator, buyer, amount, status, createdAt] of orders) {
    await pool.query("INSERT IGNORE INTO orders (order_no, content_id, creator_id, buyer_name, amount, status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, IF(? IN ('paid', 'settled'), ? , NULL), ?)", [orderNo, contentId, contentMap.get(contentId), buyer, amount, status, status, createdAt, createdAt]);
  }
  await closeDatabase();
  console.log("Demo data seeded");
}

run().catch(async (error) => { console.error(error); await closeDatabase(); process.exitCode = 1; });
