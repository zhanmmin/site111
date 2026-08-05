const mysql = require("mysql2/promise");
const config = require("./config");

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.mysql,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      timezone: "Z",
      dateStrings: true,
    });
  }
  return pool;
}

async function pingDatabase() {
  const connection = await getPool().getConnection();
  try {
    await connection.query("SELECT 1 AS ok");
    return true;
  } finally {
    connection.release();
  }
}

async function closeDatabase() {
  if (pool) await pool.end();
}

module.exports = { getPool, pingDatabase, closeDatabase };
