const bcrypt = require("bcryptjs");
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

async function run() {
  const pool = getPool();
  const creatorPasswordHash = await bcrypt.hash("creator123", 10);
  for (const [name, email, bio, lastActive] of creators) {
    await pool.query("INSERT INTO creator_users (display_name, email, password_hash, bio, status, verified_at, last_active_at) VALUES (?, ?, ?, ?, 'active', UTC_TIMESTAMP(), ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash), bio = VALUES(bio), last_active_at = VALUES(last_active_at)", [name, email, creatorPasswordHash, bio, lastActive]);
  }
  const [creatorRows] = await pool.query("SELECT id, display_name FROM creator_users");
  const creatorMap = new Map(creatorRows.map((row) => [row.display_name, row.id]));
  const statusMap = { 待审核: "pending", 已通过: "approved", 已驳回: "rejected" };
  const modeMap = { 图片: "image", 双图: "dual", "网址 / 文字": "link", 密码文字: "sensitive" };
  const riskMap = { low: "low", review: "review", high: "high" };
  for (const [id, title, mode, price, rule, status, risk, creator] of contents) {
    await pool.query("INSERT INTO contents (id, creator_id, title, mode, price, access_rule, status, risk_level, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'approved', UTC_TIMESTAMP(), NULL)) ON DUPLICATE KEY UPDATE title = VALUES(title), price = VALUES(price), access_rule = VALUES(access_rule), status = VALUES(status), risk_level = VALUES(risk_level)", [id, creatorMap.get(creator) || creatorMap.get("夜航者"), title, modeMap[mode] || mode, price, rule, statusMap[status], riskMap[risk], status]);
  }
  const contentRows = await pool.query("SELECT id, creator_id FROM contents").then(([rows]) => rows);
  const contentMap = new Map(contentRows.map((row) => [row.id, row.creator_id]));
  for (const [orderNo, contentId, creator, buyer, amount, status, createdAt] of orders) {
    await pool.query("INSERT INTO orders (order_no, content_id, creator_id, buyer_name, amount, status, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, IF(? IN ('paid', 'settled'), ? , NULL), ?) ON DUPLICATE KEY UPDATE status = VALUES(status), amount = VALUES(amount)", [orderNo, contentId, contentMap.get(contentId), buyer, amount, status, status, createdAt, createdAt]);
  }
  await closeDatabase();
  console.log("Demo data seeded");
}

run().catch(async (error) => { console.error(error); await closeDatabase(); process.exitCode = 1; });
