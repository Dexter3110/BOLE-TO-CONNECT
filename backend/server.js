// server.js


require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

const pool = require("./db"); // PostgreSQL connection
const scheduleRoutes = require("./routes/scheduleRoutes");

/* ------------------------- Core middleware ------------------------- */
// Allow only your static site (change if your frontend URL changes)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_ORIGIN || "https://bole-to-connect-1.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow no-origin requests (curl, health checks)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight quickly
app.options("*", cors());

app.use(express.json({ limit: "1mb" })); // parse JSON bodies

/* ------------------------------ Routes ----------------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

// Feature routes
app.use("/api/schedules", scheduleRoutes);

// ✅ Signup Route (kept simple; hashing/JWT can be added later)
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required!" });
  }

  try {
    const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
      return res.status(409).json({ error: "Email already exists!" });
    }

    const insert = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, password]
    );

    return res.status(201).json({
      message: "User registered successfully!",
      user: insert.rows[0],
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Login Route (simple check)
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required!" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rowCount) {
      return res.status(401).json({ error: "Invalid email or password!" });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password!" });
    }

    return res.json({
      message: "Login successful!",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* --------------------------- Server start -------------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
