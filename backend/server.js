// server.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const pool = require("./db"); // PostgreSQL connection
const scheduleRoutes = require("./routes/scheduleRoutes");

/* ------------------------- CORS Configuration ------------------------- */
// Allow only your deployed frontend
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_ORIGIN || "https://bole-to-connect-1.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an origin (e.g., Render health checks, Postman)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`❌ Blocked CORS request from: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight requests
app.options("*", cors());
app.use(express.json({ limit: "1mb" }));

/* --------------------------- Health Check --------------------------- */
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "bole-to-connect-backend" })
);

/* --------------------------- Feature Routes -------------------------- */
app.use("/api/schedules", scheduleRoutes);

/* --------------------------- Auth Routes ----------------------------- */
// ✅ Signup
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  try {
    const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "Email already exists!" });
    }

    const insert = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, password]
    );

    res.status(201).json({
      message: "User registered successfully!",
      user: insert.rows[0],
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required!" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid email or password!" });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password!" });
    }

    res.json({
      message: "Login successful!",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* --------------------------- Server Start ---------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Backend URL: https://bole-to-connect.onrender.com`);
  console.log(`✅ CORS allowed origin: ${ALLOWED_ORIGINS.join(", ")}`);
});
