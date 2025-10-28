const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ----------------------- helpers ----------------------- */
const makeEmptyTasks = () =>
  Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    details: "",
    completionDay: "",
    duration: "",
    comments: "",
  }));

const normalizeScheduleData = (scheduleData) => {
  try {
    const parsed =
      typeof scheduleData === "string" ? JSON.parse(scheduleData) : scheduleData || {};

    const notes = parsed.notes || {};
    const tasks =
      Array.isArray(parsed.tasks) && parsed.tasks.length === 7
        ? parsed.tasks
        : makeEmptyTasks();

    return { ok: true, data: { notes, tasks } };
  } catch (e) {
    console.error("Schedule data parse error:", e);
    return { ok: false, data: { notes: {}, tasks: makeEmptyTasks() } };
  }
};

/* ----------------------- routes ----------------------- */

/** Get a user's role (defaults to 'employee' if not found) */
router.get("/user-role/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const { rows } = await pool.query("SELECT role FROM users WHERE id = $1", [user_id]);
    return res.json({ role: rows[0]?.role || "employee" });
  } catch (err) {
    console.error("GET /user-role error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Create/submit a schedule (one row per submit; latest wins) */
router.post("/submit", async (req, res) => {
  const { user_id, month, schedule_data } = req.body;

  if (!user_id || !month || !schedule_data) {
    return res.status(400).json({ message: "user_id, month, and schedule_data are required" });
  }

  const normalized = normalizeScheduleData(schedule_data);

  try {
    const { rows } = await pool.query(
      `INSERT INTO schedules (user_id, month, schedule_data, is_submitted)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, month, schedule_data, is_submitted, created_at`,
      [user_id, month, JSON.stringify(normalized.data), true]
    );

    return res.status(201).json({ message: "Schedule submitted successfully!", schedule: rows[0] });
  } catch (err) {
    console.error("POST /submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * Get a user's schedule
 * - If ?month=YYYY-MM is provided, return that month (latest by created_at)
 * - Else return the latest schedule for that user
 */
router.get("/user/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { month } = req.query;

  try {
    let q, params;
    if (month) {
      q = `
        SELECT id, user_id, month, schedule_data, is_submitted, created_at, updated_at
        FROM schedules
        WHERE user_id = $1 AND month = $2
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [user_id, month];
    } else {
      q = `
        SELECT id, user_id, month, schedule_data, is_submitted, created_at, updated_at
        FROM schedules
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [user_id];
    }

    const { rows } = await pool.query(q, params);

    if (rows.length === 0) {
      return res.json({
        schedule: {
          id: null,
          user_id: Number(user_id),
          month: month || null,
          schedule_data: { notes: {}, tasks: makeEmptyTasks() },
          is_submitted: false,
          created_at: null,
          updated_at: null,
        },
      });
    }

    const row = rows[0];
    const normalized = normalizeScheduleData(row.schedule_data);
    row.schedule_data = normalized.data;

    return res.json({ schedule: row });
  } catch (err) {
    console.error("GET /user/:user_id error:", err);
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
});

/** Boss: get all employees' schedules (latest rows first) */
router.get("/all-employees", async (req, res) => {
  const { boss_id } = req.query;
  try {
    const { rows: roleRows } = await pool.query("SELECT role FROM users WHERE id = $1", [boss_id]);
    if (!roleRows[0] || !["boss", "manager", "admin"].includes(roleRows[0].role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { rows } = await pool.query(
      `SELECT s.id, s.user_id, s.month, s.schedule_data, s.is_submitted, s.created_at, s.updated_at,
              u.name, u.email
       FROM schedules s
       JOIN users u ON u.id = s.user_id
       WHERE u.role = 'employee'
       ORDER BY s.created_at DESC`
    );

    const processed = rows.map((r) => {
      const norm = normalizeScheduleData(r.schedule_data);
      r.schedule_data = norm.data;
      return r;
    });

    return res.json(processed);
  } catch (err) {
    console.error("GET /all-employees error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Boss: edit a schedule and log the change */
router.put("/edit/:schedule_id", async (req, res) => {
  const { schedule_id } = req.params;
  const { schedule_data, boss_id } = req.body;

  try {
    // verify role
    const { rows: roleRows } = await pool.query("SELECT role FROM users WHERE id = $1", [boss_id]);
    if (!roleRows[0] || !["boss", "manager", "admin"].includes(roleRows[0].role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // get previous data
    const { rows: beforeRows } = await pool.query(
      "SELECT schedule_data FROM schedules WHERE id = $1",
      [schedule_id]
    );
    if (beforeRows.length === 0) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    const previous = normalizeScheduleData(beforeRows[0].schedule_data).data;
    const next = normalizeScheduleData(schedule_data).data;

    // update schedule
    await pool.query(
      "UPDATE schedules SET schedule_data = $1, updated_at = now() WHERE id = $2",
      [JSON.stringify(next), schedule_id]
    );

    // log edit
    await pool.query(
      `INSERT INTO schedule_edits (schedule_id, edited_by, changes)
       VALUES ($1, $2, $3)`,
      [schedule_id, boss_id, JSON.stringify({ before: previous, after: next })]
    );

    return res.json({ message: "Schedule updated successfully!" });
  } catch (err) {
    console.error("PUT /edit/:schedule_id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
