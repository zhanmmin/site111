const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const config = require("./config");

async function run() {
  const rootConnection = await mysql.createConnection({
    ...config.mysql,
    user: process.env.MYSQL_ROOT_USER || "root",
    password: process.env.MYSQL_ROOT_PASSWORD || config.mysql.password,
    database: undefined,
  });
  await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConnection.end();
  const connection = await mysql.createConnection(config.mysql);
  const sql = fs.readFileSync(path.resolve(__dirname, "../sql/001_initial.sql"), "utf8");
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) await connection.query(statement);
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);
  await connection.query(
    `INSERT INTO admin_users (email, password_hash, display_name, role) VALUES (?, ?, ?, 'super_admin') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), display_name = VALUES(display_name), status = 'active'`,
    ["admin@lumenpass.com", passwordHash, "网站管理员"]
  );
  const defaults = [
    ["review_scan", "true", "boolean", "新内容进入审核队列前自动识别风险"],
    ["callback_guard", "true", "boolean", "验证支付回调签名"],
    ["maintenance_mode", "false", "boolean", "暂停新内容发布"],
  ];
  for (const setting of defaults) await connection.query("INSERT IGNORE INTO platform_settings (setting_key, setting_value, value_type, description) VALUES (?, ?, ?, ?)", setting);
  await connection.end();
  console.log(`MySQL migration completed for ${config.mysql.database}`);
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
