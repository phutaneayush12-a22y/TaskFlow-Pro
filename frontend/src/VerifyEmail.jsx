import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaEnvelope, FaSpinner, FaArrowRight } from "react-icons/fa";
import "./VerifyEmail.css";

function VerifyEmail() {
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. No token found.");
      return;
    }

    console.log("🔍 Verifying token:", token.substring(0, 20) + "...");

    // Make the verification request
    axios
      .get(`http://localhost:5000/verify-email?token=${token}`)
      .then((response) => {
        console.log("✅ Verification response:", response.data);
        
        // Check if verification was successful
        if (response.data.verified === true) {
          setStatus("success");
          setMessage(response.data.message || "Email verified successfully!");
          setUserEmail(response.data.email || "");
          setUserName(response.data.fullname || "");
          
          // Start countdown timer for redirect
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          return () => clearInterval(timer);
        } else {
          setStatus("error");
          setMessage(response.data.message || "Verification failed");
        }
      })
      .catch((error) => {
        console.error("❌ Verification error:", error);
        console.error("Error response:", error.response?.data);
        
        // Even if there's an error, check if the email was already verified
        if (error.response?.data?.message && 
            (error.response.data.message.includes("already verified") || 
             error.response.data.message.includes("success"))) {
          setStatus("success");
          setMessage(error.response.data.message);
          setUserEmail(error.response.data.email || "");
        } else {
          setStatus("error");
          setMessage(error.response?.data?.error || "Verification failed. The link may have expired.");
        }
      });
  }, []);

  // Auto redirect after countdown
  useEffect(() => {
    if (status === "success" && countdown === 0) {
      navigate("/login");
    }
  }, [status, countdown, navigate]);

  const handleManualRedirect = () => {
    navigate("/login");
  };

  const handleResendVerification = async () => {
    const email = prompt("Please enter your email address to receive a new verification link:");
    if (!email) return;
    
    try {
      await axios.post("http://localhost:5000/resend-verification", { email });
      alert("✓ New verification email sent! Please check your inbox.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send verification email");
    }
  };

  // Loading / Verifying State
  if (status === "verifying") {
    return (
      <div className="verify-container">
        <div className="verify-card">
          <div className="verify-icon verifying">
            <FaSpinner className="spin" />
          </div>
          <h2>Verifying Your Email</h2>
          <p>Please wait while we confirm your email address...</p>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  if (status === "success") {
    return (
      <div className="verify-container">
        <div className="verify-card success">
          <div className="verify-icon success">
            <FaCheckCircle />
          </div>
          <h2>Welcome, {userName || "User"}! 🎉</h2>
          <p>{message}</p>
          
          <div className="info-box">
            <FaEnvelope className="info-icon" />
            <div className="info-content">
              <h4>📧 Check Your Inbox</h4>
              <p>We've sent your <strong>Unique ID</strong> to:</p>
              <p className="email-highlight">{userEmail || "your registered email address"}</p>
              <p className="info-note">Use this ID along with your password to login to your account.</p>
            </div>
          </div>

          <div className="redirect-info">
            <p>Redirecting to login page in <strong>{countdown}</strong> seconds...</p>
            <div className="progress-bar-small">
              <div className="progress-fill-small" style={{ width: `${((5 - countdown) / 5) * 100}%` }}></div>
            </div>
          </div>

          <div className="button-group">
            <button onClick={handleManualRedirect} className="btn-primary">
              Login Now <FaArrowRight />
            </button>
            <button onClick={handleResendVerification} className="btn-secondary">
              Didn't receive email? Resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  return (
    <div className="verify-container">
      <div className="verify-card error">
        <div className="verify-icon error">
          <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>Verification Failed</h2>
        <p>{message}</p>
        
        <div className="error-actions">
          <p className="help-text">The verification link may have expired or is invalid.</p>
          <button onClick={handleResendVerification} className="btn-primary">
            Request New Verification Link
          </button>
          <button onClick={() => navigate("/login")} className="btn-secondary">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;