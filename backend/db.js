// backend/db.js
const { Pool } = require("pg");

// Prefer DATABASE_URL when present (Render)
// Force SSL for managed Postgres
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST,           // only used locally if you set them
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:
        String(process.env.DB_SSL || "").toLowerCase() === "true" ||
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });

// Helpful startup log (won’t print secrets)
console.log(
  `PG: using ${process.env.DATABASE_URL ? "DATABASE_URL" : "separate vars"}; SSL=${
    process.env.DATABASE_URL ? "true" : String(process.env.DB_SSL || (process.env.NODE_ENV === "production"))
  }`
);

// Safety: surface unexpected pool errors
pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = pool;
