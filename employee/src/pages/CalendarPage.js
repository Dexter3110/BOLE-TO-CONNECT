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
  const monthKey = `${currentYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  useEffect(() => {
    const checkIfBoss = async () => {
      try {
        const resp = await fetch(`${API}/api/schedules/user-role/${user_id}`);
        const data = await resp.json();
        if (["boss", "manager", "admin"].includes(data.role)) {
          setIsBoss(true);
          fetchEmployees();
        } else setIsBoss(false);
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
      setInputVisible(null);

      const targetUserId = selectedEmployee || user_id;
      const response = await fetch(`${API}/api/schedules/user/${targetUserId}?month=${monthKey}`);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
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
          setTasks(tasks.map(t => ({ ...t, details: "", completionDay: "", duration: "", comments: "" })));
        }
      } else {
        setNotes({});
        setTasks(tasks.map(t => ({ ...t, details: "", completionDay: "", duration: "", comments: "" })));
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
        month: monthKey,
        schedule_data: { notes, tasks },
      };

      let scheduleId;
      if (isBoss && selectedEmployee) {
        const resp = await fetch(`${API}/api/schedules/user/${selectedEmployee}?month=${monthKey}`);
        const d = await resp.json();
        const sched = d?.schedule;
        scheduleId = sched?.id || null;
      }

      const endpoint =
        isBoss && selectedEmployee && scheduleId
          ? `${API}/api/schedules/edit/${scheduleId}`
          : `${API}/api/schedules/submit`;
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
      if (!response.ok) throw new Error(result?.message || "Failed to submit schedule");

      alert(isBoss && selectedEmployee ? "Schedule updated successfully!" : "Schedule submitted successfully!");
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

  // Render code identical to your version...
  // (omitted for brevity but unchanged)
};

export default CalendarPage;
