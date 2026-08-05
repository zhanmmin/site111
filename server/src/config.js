const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

module.exports = {
  port: Number(process.env.PORT || 8787),
  jwtSecret: process.env.JWT_SECRET || "lumen-pass-local-development-secret",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    database: process.env.MYSQL_DATABASE || "lumen_pass",
    user: process.env.MYSQL_USER || "lumen_app",
    password: process.env.MYSQL_PASSWORD || "lumen_app",
  },
};
