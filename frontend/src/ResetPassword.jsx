import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import "./Login.css";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid reset link. No token provided.");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    
    setLoading(true);
    setError("");
    setMessage("");
    
    try {
      const response = await axios.post("http://localhost:5000/reset-password", {
        token,
        newPassword: password
      });
      
      setSuccess(true);
      setMessage(response.data.message || "Password reset successfully!");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
      
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-icon">TF</div>
          <h2>Reset <span>Password</span></h2>
          <p className="welcome-text">Create a new password for your account</p>
        </div>

        {error && (
          <div className="error-message" style={{ 
            background: "#fee2e2", 
            color: "#dc2626", 
            padding: "12px", 
            borderRadius: "10px", 
            marginBottom: "20px", 
            textAlign: "center",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message" style={{ 
            background: "#d1fae5", 
            color: "#10b981", 
            padding: "12px", 
            borderRadius: "10px", 
            marginBottom: "20px", 
            textAlign: "center",
            fontSize: "14px"
          }}>
            {message}
          </div>
        )}

        {!success && token && (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="password-requirements" style={{ 
              fontSize: "12px", 
              color: "#666", 
              marginBottom: "20px",
              textAlign: "center"
            }}>
              Password must be at least 4 characters
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {!token && !success && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#dc2626", marginBottom: "20px" }}>{error}</p>
            <button onClick={() => navigate("/login")} className="submit-btn" style={{ marginTop: "10px" }}>
              <FaArrowLeft /> Back to Login
            </button>
          </div>
        )}

        {success && (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <button onClick={() => navigate("/login")} className="submit-btn">
              <FaArrowLeft /> Go to Login
            </button>
          </div>
        )}

        <p className="toggle-link" style={{ marginTop: "20px" }}>
          Remember your password?
          <span onClick={() => navigate("/login")}> Back to Login</span>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;