const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { getPool } = require("./db");

async function loginAdmin(email, password) {
  const [rows] = await getPool().query(
    "SELECT id, email, password_hash, display_name, role, status FROM admin_users WHERE email = ? LIMIT 1",
    [email.toLowerCase()]
  );
  const admin = rows[0];
  if (!admin || admin.status !== "active" || !(await bcrypt.compare(password, admin.password_hash))) return null;
  await getPool().query("UPDATE admin_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [admin.id]);
  return {
    token: jwt.sign({ sub: String(admin.id), email: admin.email, role: admin.role, displayName: admin.display_name }, config.jwtSecret, { expiresIn: "8h" }),
    admin: { id: admin.id, email: admin.email, displayName: admin.display_name, role: admin.role },
  };
}

async function loginCreator(email, password) {
  const [rows] = await getPool().query(
    "SELECT id, email, password_hash, display_name, status FROM creator_users WHERE email = ? LIMIT 1",
    [email.toLowerCase()]
  );
  const creator = rows[0];
  if (!creator || creator.status !== "active" || !creator.password_hash || !(await bcrypt.compare(password, creator.password_hash))) return null;
  await getPool().query("UPDATE creator_users SET last_login_at = UTC_TIMESTAMP(), last_active_at = UTC_TIMESTAMP() WHERE id = ?", [creator.id]);
  return {
    token: jwt.sign({ sub: String(creator.id), email: creator.email, role: "creator", displayName: creator.display_name }, config.jwtSecret, { expiresIn: "8h" }),
    creator: { id: creator.id, email: creator.email, displayName: creator.display_name },
  };
}

function requireAdmin(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED", message: "需要管理员登录" });
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    if (!['super_admin', 'operator', 'reviewer'].includes(req.admin.role)) return res.status(403).json({ error: "FORBIDDEN", message: "无权访问管理员接口" });
    return next();
  } catch (error) {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "管理员登录已过期" });
  }
}

function requireCreator(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED", message: "需要创作者登录" });
  try {
    req.creator = jwt.verify(token, config.jwtSecret);
    if (req.creator.role !== "creator") return res.status(403).json({ error: "FORBIDDEN", message: "无权访问创作者接口" });
    return next();
  } catch (error) {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "创作者登录已过期" });
  }
}

module.exports = { loginAdmin, loginCreator, requireAdmin, requireCreator };
