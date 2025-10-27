
// backend/db.js
const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL, // from Render
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || "boleto_connect",
        user: process.env.DB_USER || "boleto_user",
        password: process.env.DB_PASSWORD,
        ssl:
          process.env.NODE_ENV === "production" || String(process.env.DB_SSL).toLowerCase() === "true"
            ? { rejectUnauthorized: false }
            : false,
      }
);

module.exports = pool;
