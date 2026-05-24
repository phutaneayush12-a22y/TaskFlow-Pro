import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Login from './Login'
import VerifyEmail from './VerifyEmail'
import ResetPassword from './ResetPassword'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'
import './VerifyEmail.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login setUser={(user) => {
            localStorage.setItem("user", JSON.stringify(user));
            window.location.href = "/";
          }} />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)