import React, { useState, useEffect, useCallback } from "react";
import {
  FaRegStickyNote,
  FaCalendarAlt,
  FaTasks,
  FaDownload,
  FaUserCog,
} from "react-icons/fa";
import Button from "../Components/ui/button";
import jsPDF from "jspdf";
import MotivationalMessageInput from "../Components/MotivationalMessageInput";
import { API } from "../api";
import "../pages/CalendarPage.css";

const CalendarPage = () => {
  /* ----------------------- State ----------------------- */
  const [notes, setNotes] = useState({});
  const [tasks, setTasks] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      details: "",
      completionDay: "",
      duration: "",
      comments: "",
    }))
  );

  const [inputVisible, setInputVisible] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [isBoss, setIsBoss] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  /* ----------------------- Constants ----------------------- */
  const currentYear = new Date().getFullYear();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const daysInMonth = new Date(currentYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, selectedMonth, 1).getDay();
  const user_id = localStorage.getItem("user_id");
  const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  /* ----------------------- Role Check ----------------------- */
  useEffect(() => {
    const checkIfBoss = async () => {
      try {
        const resp = await fetch(`${API}/api/schedules/user-role/${user_id}`);
        const data = await resp.json();

        if (["boss", "manager", "admin"].includes(data.role)) {
          setIsBoss(true);
          fetchEmployees();
        } else {
          setIsBoss(false);
        }
      } catch (err) {
        console.error("Error checking user role:", err);
      }
    };

    if (user_id) checkIfBoss();
  }, [user_id]);

  /* ----------------------- Fetch Employees ----------------------- */
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/schedules/all-employees?boss_id=${user_id}`);
      const data = await response.json();

      const uniqueEmployees = [...new Set(data.map((s) => s.user_id))].map((id) => {
        const e = data.find((s) => s.user_id === id);
        return { id: e.user_id, name: e.name, email: e.email };
      });

      setEmployees(uniqueEmployees);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, [user_id]);

  /* ----------------------- Fetch Schedule ----------------------- */
  const fetchScheduleData = useCallback(async () => {
    if (!user_id) {
      setError("User not logged in");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const targetUserId = selectedEmployee || user_id;
      const response = await fetch(`${API}/api/schedules/user/${targetUserId}?month=${monthKey}`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const schedule = data?.schedule;

      if (schedule && schedule.schedule_data) {
        const payload =
          typeof schedule.schedule_data === "string"
            ? JSON.parse(schedule.schedule_data)
            : schedule.schedule_data;

        setNotes(payload?.notes || {});
        setTasks(
          Array.isArray(payload?.tasks) && payload.tasks.length === 7
            ? payload.tasks
            : tasks.map((t) => ({ ...t, details: "", completionDay: "", duration: "", comments: "" }))
        );
      } else {
        setNotes({});
        setTasks(tasks.map((t) => ({ ...t, details: "", completionDay: "", duration: "", comments: "" })));
      }
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setError("Failed to fetch schedule. Please try again.");
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [user_id, selectedEmployee, monthKey]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  /* ----------------------- Note Handlers ----------------------- */
  const handleNoteClick = (day) => {
    setInputVisible(day);
    setNewNote(notes?.[day] || "");
  };

  const handleNoteSave = (day) => {
    setNotes({ ...notes, [day]: newNote });
    setInputVisible(null);
  };

  /* ----------------------- Task Handlers ----------------------- */
  const handleTaskEdit = (taskId) => setEditingTask(taskId);

  const handleTaskSave = (taskId, field, value) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
    );
  };

  const handleTaskSubmit = () => setEditingTask(null);

  /* ----------------------- Submit / Update ----------------------- */
  const handleSubmit = async () => {
    if (!user_id) {
      alert("User ID not found. Please log in again.");
      return;
    }

    try {
      const payload = {
        user_id: selectedEmployee || user_id,
        month: monthKey,
        schedule_data: { notes, tasks },
      };

      let scheduleId;
      if (isBoss && selectedEmployee) {
        const resp = await fetch(`${API}/api/schedules/user/${selectedEmployee}?month=${monthKey}`);
        const d = await resp.json();
        scheduleId = d?.schedule?.id || null;
      }

      const endpoint =
        isBoss && selectedEmployee && scheduleId
          ? `${API}/api/schedules/edit/${scheduleId}`
          : `${API}/api/schedules/submit`;

      const method = isBoss && selectedEmployee && scheduleId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, boss_id: isBoss ? user_id : undefined }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Failed to submit schedule");

      alert(
        isBoss && selectedEmployee
          ? "Schedule updated successfully!"
          : "Schedule submitted successfully!"
      );

      fetchScheduleData();
    } catch (err) {
      console.error("Error submitting schedule:", err);
      alert("An error occurred while submitting the schedule.");
    }
  };

  /* ----------------------- PDF Download ----------------------- */
  const downloadSchedule = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text(`📅 ${months[selectedMonth]} ${currentYear} Schedule`, 10, 10);

    let y = 20;
    Object.entries(notes || {}).forEach(([day, note]) => {
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(`Day ${day}: ${note}`, 180);
      doc.text(wrapped, 10, y);
      y += wrapped.length * 6;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Tasks:", 10, y);
    y += 10;

    tasks.forEach((t) => {
      doc.setFont("helvetica", "normal");
      const txt = doc.splitTextToSize(
        `Task ${t.id}:\nDetails: ${t.details}\nCompletion Day: ${t.completionDay}\nDuration: ${t.duration}\nComments: ${t.comments}`,
        180
      );
      doc.text(txt, 10, y);
      y += txt.length * 6 + 5;
    });

    doc.save(`schedule_${months[selectedMonth]}_${currentYear}.pdf`);
  };

  /* ----------------------- Render Task ----------------------- */
  const renderTaskBox = (task) => (
    <div key={task.id} className="task-box">
      <div className="task-header">
        <h3>Task {task.id}</h3>
        {editingTask !== task.id && (
          <button className="edit-task-btn" onClick={() => handleTaskEdit(task.id)}>
            Edit
          </button>
        )}
      </div>

      {editingTask === task.id ? (
        <div className="task-edit-form">
          {["details", "completionDay", "duration"].map((field) => (
            <div key={field} className="task-field">
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}:</label>
              <input
                type="text"
                value={task[field]}
                onChange={(e) => handleTaskSave(task.id, field, e.target.value)}
                placeholder={`Enter ${field}`}
              />
            </div>
          ))}
          <div className="task-field">
            <label>Comments:</label>
            <textarea
              value={task.comments}
              onChange={(e) => handleTaskSave(task.id, "comments", e.target.value)}
              placeholder="Enter comments"
            />
          </div>
          <button className="save-task-btn" onClick={handleTaskSubmit}>
            Save
          </button>
        </div>
      ) : (
        <div className="task-display">
          <p><strong>Details:</strong> {task.details || "No details added"}</p>
          <p><strong>Completion Day:</strong> {task.completionDay || "Not set"}</p>
          <p><strong>Duration:</strong> {task.duration || "Not set"}</p>
          <p><strong>Comments:</strong> {task.comments || "No comments"}</p>
        </div>
      )}
    </div>
  );

  /* ----------------------- Render ----------------------- */
  if (!dataLoaded) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">❌</div>
        <p>{error}</p>
        <button className="retry-btn" onClick={fetchScheduleData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      {/* Header */}
      <div className="calendar-header">
        <h1 className="calendar-title">
          <FaCalendarAlt className="header-icon" /> {months[selectedMonth]} {currentYear} Schedule
        </h1>

        <div className="header-controls">
          {/* Month Selector */}
          <div className="select-container">
            <select
              className="month-selector"
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              value={selectedMonth}
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>

          {/* Employee Selector */}
          {isBoss && (
            <div className="select-container employee-select">
              <FaUserCog className="select-icon" />
              <select
                value={selectedEmployee || ""}
                onChange={(e) => setSelectedEmployee(e.target.value || null)}
                className="employee-dropdown"
              >
                <option value="">My Schedule</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Motivational Input (Boss Only) */}
      {isBoss && !selectedEmployee && (
        <div className="motivational-message-container">
          <MotivationalMessageInput />
        </div>
      )}

      {/* Calendar */}
      <div className="calendar-section">
        <div className="calendar-weekdays">
          {weekdays.map((day) => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {[...Array(firstDayOfMonth)].map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty"></div>
          ))}

          {[...Array(daysInMonth)].map((_, i) => (
            <div
              key={i}
              className={`calendar-day ${
                new Date().getDate() === i + 1 && new Date().getMonth() === selectedMonth
                  ? "today"
                  : ""
              }`}
            >
              <div className="day-header">
                <span className="day-number">{i + 1}</span>
                <FaRegStickyNote className="note-icon" onClick={() => handleNoteClick(i + 1)} />
              </div>

              {inputVisible === i + 1 ? (
                <div className="note-input-container">
                  <textarea
                    className="note-input"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter note..."
                  />
                  <button className="save-btn" onClick={() => handleNoteSave(i + 1)}>
                    Save
                  </button>
                </div>
              ) : (
                notes[i + 1] && <p className="note-text">{notes[i + 1]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div className="tasks-section">
        <h2 className="section-title">
          <FaTasks className="section-icon" /> Monthly Tasks
        </h2>
        <div className="tasks-grid">{tasks.map((task) => renderTaskBox(task))}</div>
      </div>

      {/* Actions */}
      <div className="actions-section">
        <Button onClick={handleSubmit} className="primary-btn submit-btn">
          {isBoss && selectedEmployee ? "Update Schedule" : "Submit Schedule"}
        </Button>
        <Button onClick={downloadSchedule} className="secondary-btn download-btn">
          <FaDownload className="btn-icon" /> Download Schedule
        </Button>
      </div>
    </div>
  );
};

export default CalendarPage;
