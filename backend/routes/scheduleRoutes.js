const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ----------------------- Helpers ----------------------- */

/** Generate a blank 7-day task list */
const makeEmptyTasks = () =>
  Array.from({ length: 7 }, (_, i) => ({
    id: i + 1,
    details: "",
    completionDay: "",
    duration: "",
    comments: "",
  }));

/** Normalize schedule data (safe JSON parse + defaults) */
const normalizeScheduleData = (scheduleData) => {
  try {
    const parsed =
      typeof scheduleData === "string"
        ? JSON.parse(scheduleData)
        : scheduleData || {};

    const notes = parsed.notes || {};
    const tasks =
      Array.isArray(parsed.tasks) && parsed.tasks.length === 7
        ? parsed.tasks
        : makeEmptyTasks();

    return { ok: true, data: { notes, tasks } };
  } catch (err) {
    console.error("Schedule data parse error:", err);
    return { ok: false, data: { notes: {}, tasks: makeEmptyTasks() } };
  }
};

/* ----------------------- Routes ----------------------- */

/** Get a user's role (defaults to 'employee' if not found) */
router.get("/user-role/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const { rows } = await pool.query("SELECT role FROM users WHERE id = $1", [
      user_id,
    ]);

    return res.json({ role: rows[0]?.role || "employee" });
  } catch (err) {
    console.error("GET /user-role error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Create or submit a schedule (latest wins) */
router.post("/submit", async (req, res) => {
  const { user_id, month, schedule_data } = req.body;

  if (!user_id || !month || !schedule_data) {
    return res
      .status(400)
      .json({ message: "user_id, month, and schedule_data are required" });
  }

  const normalized = normalizeScheduleData(schedule_data);

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO schedules (user_id, month, schedule_data, is_submitted)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, month, schedule_data, is_submitted, created_at
      `,
      [user_id, month, normalized.data, true]
    );

    return res.status(201).json({
      message: "Schedule submitted successfully!",
      schedule: rows[0],
    });
  } catch (err) {
    console.error("POST /submit error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Get a user's schedule (specific month or latest) */
router.get("/user/:user_id", async (req, res) => {
  const { user_id } = req.params;
  const { month } = req.query;

  try {
    const query = `
      SELECT id, user_id, month, schedule_data, is_submitted, created_at, updated_at
      FROM schedules
      WHERE user_id = $1
      ${month ? "AND month = $2" : ""}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const params = month ? [user_id, month] : [user_id];
    const { rows } = await pool.query(query, params);

    if (rows.length === 0) {
      // Return an empty shaped schedule so UI can render gracefully
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

    const schedule = rows[0];
    schedule.schedule_data = normalizeScheduleData(schedule.schedule_data).data;

    return res.json({ schedule });
  } catch (err) {
    console.error("GET /user/:user_id error:", err);
    return res.status(500).json({ message: "Failed to fetch schedule" });
  }
});

/** Boss: get all employees' schedules (latest first) */
router.get("/all-employees", async (req, res) => {
  const { boss_id } = req.query;

  try {
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [boss_id]
    );

    const role = roleRows[0]?.role;
    if (!role || !["boss", "manager", "admin"].includes(role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { rows } = await pool.query(`
      SELECT 
        s.id, s.user_id, s.month, s.schedule_data, s.is_submitted,
        s.created_at, s.updated_at, u.name, u.email
      FROM schedules s
      JOIN users u ON u.id = s.user_id
      WHERE u.role = 'employee'
      ORDER BY s.created_at DESC
    `);

    const processed = rows.map((r) => ({
      ...r,
      schedule_data: normalizeScheduleData(r.schedule_data).data,
    }));

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
    // Verify editor's role
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [boss_id]
    );

    const role = roleRows[0]?.role;
    if (!role || !["boss", "manager", "admin"].includes(role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Fetch previous data
    const { rows: beforeRows } = await pool.query(
      "SELECT schedule_data FROM schedules WHERE id = $1",
      [schedule_id]
    );

    if (beforeRows.length === 0) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    const previous = normalizeScheduleData(beforeRows[0].schedule_data).data;
    const next = normalizeScheduleData(schedule_data).data;

    // Update schedule
    await pool.query(
      "UPDATE schedules SET schedule_data = $1, updated_at = now() WHERE id = $2",
      [next, schedule_id]
    );

    // Log the edit
    await pool.query(
      `
      INSERT INTO schedule_edits (schedule_id, edited_by, changes)
      VALUES ($1, $2, $3)
      `,
      [schedule_id, boss_id, { before: previous, after: next }]
    );

    return res.json({ message: "Schedule updated successfully!" });
  } catch (err) {
    console.error("PUT /edit/:schedule_id error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
