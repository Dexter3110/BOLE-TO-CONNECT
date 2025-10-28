import React, { useState, useEffect, useCallback } from "react";
import { FaRegStickyNote, FaCalendarAlt, FaTasks, FaDownload, FaUserCog } from "react-icons/fa";
import Button from "../Components/ui/button";
import "../pages/CalendarPage.css";
import jsPDF from "jspdf";
import MotivationalMessageInput from "../Components/MotivationalMessageInput";
import { API } from "../api";

const CalendarPage = () => {
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

  const currentYear = new Date().getFullYear();
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const daysInMonth = new Date(currentYear, selectedMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, selectedMonth, 1).getDay();
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const user_id = localStorage.getItem("user_id");

  // helper: YYYY-MM key for API
  const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  // Check role + load employees if boss
  useEffect(() => {
    const checkIfBoss = async () => {
      try {
        // RELATIVE path -> CRA proxy to :5000
        const resp = await fetch(`${API}/api/schedules/user-role/${user_id}`);
        const data = await resp.json();
        if (data.role === "boss" || data.role === "manager" || data.role === "admin") {
          setIsBoss(true);
          fetchEmployees();
        } else {
          setIsBoss(false);
        }
      } catch (e) {
        console.error("Error checking user role:", e);
      }
    };
    if (user_id) checkIfBoss();
  }, [user_id]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/schedules/all-employees?boss_id=${user_id}`);
      const data = await response.json();
      const uniqueEmployees = [...new Set(data.map(s => s.user_id))].map(id => {
        const e = data.find(s => s.user_id === id);
        return { id: e.user_id, name: e.name, email: e.email };
      });
      setEmployees(uniqueEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, [user_id]);

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

      // RELATIVE path + month as YYYY-MM
      const response = await fetch(`${API}/api/schedules/user/${targetUserId}?month=${monthKey}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Backend returns { schedule: {...} } (or null-like object)
      const schedule = data?.schedule || null;

      if (schedule && schedule.schedule_data) {
        const payload =
          typeof schedule.schedule_data === "string"
            ? JSON.parse(schedule.schedule_data)
            : schedule.schedule_data;

        setNotes(payload?.notes || {});
        if (Array.isArray(payload?.tasks) && payload.tasks.length === 7) {
          setTasks(payload.tasks);
        } else {
          setTasks(prev =>
            prev.map(t => ({ ...t, details: "", completionDay: "", duration: "", comments: "" }))
          );
        }
      } else {
        // No schedule yet -> reset fields
        setNotes({});
        setTasks(prev =>
          prev.map(t => ({ ...t, details: "", completionDay: "", duration: "", comments: "" }))
        );
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

  const handleNoteClick = (day) => {
    setInputVisible(day);
    setNewNote(notes?.[day] || "");
  };
  const handleNoteSave = (day) => {
    setNotes({ ...notes, [day]: newNote });
    setInputVisible(null);
  };
  const handleTaskEdit = (taskId) => setEditingTask(taskId);
  const handleTaskSave = (taskId, field, value) => {
    setTasks(tasks.map(t => (t.id === taskId ? { ...t, [field]: value } : t)));
  };
  const handleTaskSubmit = () => setEditingTask(null);

  const handleSubmit = async () => {
    if (!user_id) {
      alert("User ID not found. Please log in again.");
      return;
    }
    try {
      const payload = {
        user_id: selectedEmployee || user_id,
        month: monthKey, // send YYYY-MM
        schedule_data: { notes, tasks },
      };

      // If boss editing an existing schedule, fetch id first
      let scheduleId;
      if (isBoss && selectedEmployee) {
        const resp = await fetch(`${API}/api/schedules/user/${selectedEmployee}?month=${monthKey}`);
        const d = await resp.json();
        const sched = d?.schedule;
        scheduleId = sched?.id || null;
      }

      const endpoint =
        isBoss && selectedEmployee && scheduleId
          ? `/api/schedules/edit/${scheduleId}`
          : `/api/schedules/submit`;
      const method = isBoss && selectedEmployee && scheduleId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          boss_id: isBoss ? user_id : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Failed to submit schedule");
      }

      alert(
        isBoss && selectedEmployee ? "Schedule updated successfully!" : "Schedule submitted successfully!"
      );
      fetchScheduleData();
    } catch (error) {
      console.error("Error submitting schedule:", error);
      alert("An error occurred while submitting the schedule.");
    }
  };

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
          <div className="task-field">
            <label>Details:</label>
            <input
              type="text"
              value={task.details}
              onChange={(e) => handleTaskSave(task.id, "details", e.target.value)}
              placeholder="Enter task details"
            />
          </div>
          <div className="task-field">
            <label>Completion Day:</label>
            <input
              type="text"
              value={task.completionDay}
              onChange={(e) => handleTaskSave(task.id, "completionDay", e.target.value)}
              placeholder="Enter completion day"
            />
          </div>
          <div className="task-field">
            <label>Duration:</label>
            <input
              type="text"
              value={task.duration}
              onChange={(e) => handleTaskSave(task.id, "duration", e.target.value)}
              placeholder="Enter duration"
            />
          </div>
          <div className="task-field">
            <label>Comments:</label>
            <textarea
              value={task.comments}
              onChange={(e) => handleTaskSave(task.id, "comments", e.target.value)}
              placeholder="Enter comments"
            />
          </div>
          <button className="save-task-btn" onClick={handleTaskSubmit}>Save</button>
        </div>
      ) : (
        <div className="task-display">
          <div className="task-info">
            <p><strong>Details:</strong> {task.details || "No details added"}</p>
            <p><strong>Completion Day:</strong> {task.completionDay || "Not set"}</p>
            <p><strong>Duration:</strong> {task.duration || "Not set"}</p>
            <p><strong>Comments:</strong> {task.comments || "No comments"}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="calendar-page">
      {!dataLoaded ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your schedule...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <div className="error-icon">❌</div>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchScheduleData}>Retry</button>
        </div>
      ) : (
        <>
          <div className="calendar-header">
            <h1 className="calendar-title">
              <FaCalendarAlt className="header-icon" /> {months[selectedMonth]} {currentYear} Schedule
            </h1>

            <div className="header-controls">
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

          {isBoss && !selectedEmployee && (
            <div className="motivational-message-container">
              <MotivationalMessageInput />
            </div>
          )}

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
                    new Date().getDate() === i + 1 && new Date().getMonth() === selectedMonth ? "today" : ""
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
                      <button className="save-btn" onClick={() => handleNoteSave(i + 1)}>Save</button>
                    </div>
                  ) : (
                    notes[i + 1] && <p className="note-text">{notes[i + 1]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="tasks-section">
            <h2 className="section-title">
              <FaTasks className="section-icon" /> Monthly Tasks
            </h2>
            <div className="tasks-grid">
              {tasks.map((task) => renderTaskBox(task))}
            </div>
          </div>

          <div className="actions-section">
            <Button onClick={handleSubmit} className="primary-btn submit-btn">
              {isBoss && selectedEmployee ? "Update Schedule" : "Submit Schedule"}
            </Button>
            <Button onClick={downloadSchedule} className="secondary-btn download-btn">
              <FaDownload className="btn-icon" /> Download Schedule
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarPage;
