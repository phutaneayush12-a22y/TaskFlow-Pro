import { useState } from "react";
import axios from "axios";
import { 
  FaUser, FaLock, FaEnvelope, FaIdCard, FaEye, FaEyeSlash, 
  FaArrowRight, FaShieldAlt, FaSpinner
} from "react-icons/fa";
import "./Login.css";

function Login({ setUser }) {
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotId, setShowForgotId] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isHuman, setIsHuman] = useState(false);
  
  // Email verification states
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resending, setResending] = useState(false);

  const [form, setForm] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    about: "",
  });

  const [loginData, setLoginData] = useState({
    unique_id: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (requiresVerification) {
      setRequiresVerification(false);
      setUnverifiedEmail("");
    }
  };

  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
    if (requiresVerification) {
      setRequiresVerification(false);
      setUnverifiedEmail("");
    }
  };

  const resendVerificationEmail = async () => {
    setResending(true);
    try {
      await axios.post("http://localhost:5000/resend-verification", {
        email: unverifiedEmail,
      });
      alert("✓ Verification email sent! Please check your inbox.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send verification email");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async () => {
    if (!isHuman && !isSignup) {
      alert("Please verify you're human");
      return;
    }
    
    setLoading(true);
    try {
      if (isSignup) {
        const res = await axios.post("http://localhost:5000/signup", form);
        alert(res.data.message);
        setIsSignup(false);
        setForm({ fullname: "", username: "", email: "", password: "", about: "" });
        setLoginData({ unique_id: "", password: "" });
      } else {
        const res = await axios.post("http://localhost:5000/login", {
          unique_id: loginData.unique_id,
          password: loginData.password,
        });

        if (res.data.id) {
          const userData = {
            id: res.data.id,
            unique_id: res.data.unique_id,
            fullname: res.data.fullname,
            username: res.data.username,
            email: res.data.email,
            about: res.data.about,
            role: res.data.role,
            isVerified: res.data.isVerified
          };
          
          if (rememberMe) {
            localStorage.setItem("rememberedUser", JSON.stringify({
              unique_id: loginData.unique_id,
              password: loginData.password
            }));
          } else {
            localStorage.removeItem("rememberedUser");
          }
          
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));
        } else {
          alert("Invalid Unique ID or Password");
        }
      }
    } catch (err) {
      console.error("Login/Signup error:", err);
      
      if (err.response?.data?.requiresVerification) {
        setRequiresVerification(true);
        setUnverifiedEmail(err.response.data.email);
      } else if (err.response?.data?.needsNewToken) {
        setRequiresVerification(true);
        setUnverifiedEmail(err.response.data.email);
        alert("Your verification link has expired. Please request a new one.");
      } else if (err.response) {
        alert(err.response.data.error || "Invalid Unique ID or Password");
      } else if (err.request) {
        alert("Cannot connect to server. Make sure backend is running on http://localhost:5000");
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotId = async () => {
    if (!forgotEmail) {
      alert("Please enter your email address");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/forgot-id", { email: forgotEmail });
      alert("Your Unique ID has been sent to your email!");
      setShowForgotId(false);
      setForgotEmail("");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send ID. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      alert("Please enter your email address");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post("http://localhost:5000/forgot-password", { email: resetEmail });
      setResetSent(true);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="logo-icon">TF</div>
          <h2>TaskFlow <span>Pro</span></h2>
          <p className="welcome-text">
            {isSignup ? "Create your account" : "Welcome back! Please login to your account"}
          </p>
        </div>

        {isSignup ? (
          // SIGNUP FORM
          <div className="auth-form">
            <div className="input-group">
              <FaUser className="input-icon" />
              <input
                name="fullname"
                placeholder="Full Name"
                onChange={handleChange}
                value={form.fullname}
                required
              />
            </div>
            
            <div className="input-group">
              <FaUser className="input-icon" />
              <input
                name="username"
                placeholder="Username"
                onChange={handleChange}
                value={form.username}
                required
              />
            </div>
            
            <div className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                name="email"
                type="email"
                placeholder="Email Address"
                onChange={handleChange}
                value={form.email}
                required
              />
            </div>
            
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                onChange={handleChange}
                value={form.password}
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
            
            <textarea
              name="about"
              placeholder="Why do you want to use TaskFlow Pro? (Optional)"
              onChange={handleChange}
              value={form.about}
              rows="3"
              className="about-textarea"
            />
          </div>
        ) : (
          // LOGIN FORM with Enter Key Submit
          <div className="auth-form">
            <div className="input-group">
              <FaIdCard className="input-icon" />
              <input
                name="unique_id"
                placeholder="Unique ID"
                onChange={handleLoginChange}
                value={loginData.unique_id}
                autoCapitalize="characters"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && loginData.unique_id && loginData.password) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                onChange={handleLoginChange}
                value={loginData.password}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && loginData.unique_id && loginData.password) {
                    handleSubmit();
                  }
                }}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Options Row with both Forgot links */}
            <div className="options-row">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <div className="forgot-links">
                <button 
                  type="button" 
                  className="forgot-link"
                  onClick={() => setShowForgotId(true)}
                >
                  Forgot ID?
                </button>
                <span className="separator">|</span>
                <button 
                  type="button" 
                  className="forgot-link"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* Human Verification */}
            <div className="human-verification">
              <label className={`checkbox-label human-check ${isHuman ? 'checked' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={isHuman}
                  onChange={(e) => setIsHuman(e.target.checked)}
                />
                <FaShieldAlt className="shield-icon" />
                <span>I'm not a robot</span>
              </label>
            </div>

            {/* Verification Prompt */}
            {requiresVerification && (
              <div className="verification-prompt">
                <p>⚠️ Please verify your email address</p>
                <p>A verification link was sent to <strong>{unverifiedEmail}</strong></p>
                <button 
                  onClick={resendVerificationEmail} 
                  disabled={resending}
                  className="resend-btn"
                >
                  {resending ? "Sending..." : "Resend Verification Email"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button onClick={handleSubmit} disabled={loading} className="submit-btn">
          {loading ? (
            <FaSpinner className="spinner" />
          ) : (
            isSignup ? "Create Account" : "Login"
          )}
          {!loading && <FaArrowRight className="btn-arrow" />}
        </button>

        {/* Toggle Link */}
        <p className="toggle-link">
          {isSignup ? "Already have an account?" : "New to TaskFlow Pro?"}
          <span onClick={() => {
            setIsSignup(!isSignup);
            setLoginData({ unique_id: "", password: "" });
            setRequiresVerification(false);
            setUnverifiedEmail("");
            setIsHuman(false);
          }}>
            {isSignup ? " Sign In" : " Create an account"}
          </span>
        </p>
      </div>

      {/* Forgot ID Modal */}
      {showForgotId && (
        <div className="modal-overlay" onClick={() => {
          setShowForgotId(false);
          setForgotEmail("");
        }}>
          <div className="forgot-modal" onClick={e => e.stopPropagation()}>
            <h3>Forgot Unique ID?</h3>
            <p>Enter your registered email address and we'll send you your Unique ID.</p>
            <div className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                placeholder="Your Email Address"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && forgotEmail) {
                    handleForgotId();
                  }
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => {
                setShowForgotId(false);
                setForgotEmail("");
              }}>Cancel</button>
              <button className="btn-primary" onClick={handleForgotId} disabled={loading}>
                {loading ? "Sending..." : "Send Unique ID"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay" onClick={() => {
          setShowForgotPassword(false);
          setResetSent(false);
          setResetEmail("");
        }}>
          <div className="forgot-modal" onClick={e => e.stopPropagation()}>
            <h3>Forgot Password?</h3>
            {!resetSent ? (
              <>
                <p>Enter your registered email address. We'll send you a link to reset your password.</p>
                <div className="input-group">
                  <FaEnvelope className="input-icon" />
                  <input
                    type="email"
                    placeholder="Your Email Address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && resetEmail) {
                        handleForgotPassword();
                      }
                    }}
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                  }}>Cancel</button>
                  <button className="btn-primary" onClick={handleForgotPassword} disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="success-icon-modal">✅</div>
                <p>Password reset link has been sent to your email!</p>
                <p className="note-small">Please check your inbox and follow the instructions.</p>
                <button className="btn-primary" onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetEmail("");
                }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;