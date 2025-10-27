// backend/db.js
const { Pool } = require("pg");
require("dotenv").config();

// Determine if DATABASE_URL is present
const useDatabaseUrl = !!process.env.DATABASE_URL;

// Configure PostgreSQL connection
const poolConfig = useDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === "true" ||
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl:
        process.env.DB_SSL === "true" ||
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    };

// Create a PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Log connection info
console.log("🗄️  PostgreSQL connection established:");
console.log(`   - Using: ${useDatabaseUrl ? "DATABASE_URL (Render)" : "Local .env variables"}`);
console.log(`   - SSL: ${poolConfig.ssl ? "Enabled" : "Disabled"}`);
console.log(`   - Host: ${poolConfig.host || "Render (via DATABASE_URL)"}`);
console.log(`   - DB: ${process.env.DB_NAME}`);

// Handle unexpected errors
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL pool error:", err);
  process.exit(-1);
});

module.exports = pool;
