// backend/db.js
const { Pool } = require("pg");
require("dotenv").config();

const bool = (v) => String(v).toLowerCase() === "true";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "boleto_connect",
  user: process.env.DB_USER || "boleto_user",
  password: process.env.DB_PASSWORD || "Dexter2107",
  ssl: bool(process.env.DB_SSL) || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// Helpful log on startup (won’t print password)
console.log(
  `PG connecting to ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} ` +
  `(ssl=${!!(bool(process.env.DB_SSL) || process.env.NODE_ENV === "production")})`
);

// Catch unexpected client errors so they don’t crash the app
pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = pool;

