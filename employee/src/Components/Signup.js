import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Signup.css";
import { API } from "../api";

const Signup = () => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 201 && data?.token) {
        // Save token/user if you want to keep the user logged-in
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        setMessage("Signup successful! Redirecting to login…");
        setTimeout(() => navigate("/login"), 1200);
      } else if (res.status === 409) {
        setMessage("Email already registered");
      } else if (res.status === 400) {
        setMessage(data?.error || "All fields are required");
      } else {
        setMessage(data?.error || "Signup failed. Please try again.");
      }
    } catch (_err) {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = message.toLowerCase().includes("successful");

  return (
    <div className="auth-container signup-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">Create an Account</h2>
          <p className="auth-subtitle">Join Boleto Connect and manage your events</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="Create a secure password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-btn signup-btn" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </button>
        </form>

        {message && (
          <div className={`message-box ${isSuccess ? "success" : "error"}`}>
            {message}
          </div>
        )}

        <div className="auth-footer">
          <p className="auth-link">
            Already have an account? <a href="/login">Log In</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
