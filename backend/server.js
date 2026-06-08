require('dotenv').config();

// ============ FORCE RAILWAY ENVIRONMENT VARIABLES ============
// Map Railway's MySQL variables to the format your code expects
if (process.env.MYSQLHOST) {
    console.log('🔵 RUNNING ON RAILWAY - Using Railway MySQL');
    process.env.DB_HOST = process.env.MYSQLHOST;
    process.env.DB_USER = process.env.MYSQLUSER;
    process.env.DB_PASSWORD = process.env.MYSQLPASSWORD;
    process.env.DB_NAME = process.env.MYSQLDATABASE;
    process.env.DB_PORT = process.env.MYSQLPORT;
} else {
    console.log('🟢 RUNNING LOCALLY - Using local MySQL');
    // Default local values if not set
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_USER = process.env.DB_USER || 'root';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
    process.env.DB_NAME = process.env.DB_NAME || 'task_manager';
    process.env.DB_PORT = process.env.DB_PORT || '3306';
}

console.log('📊 Database Connection:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cron = require('node-cron');
const XLSX = require('xlsx');
const { format } = require('date-fns');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'https://*.netlify.app', 'https://taskflow-pro-production-acce.up.railway.app'],
    credentials: true
}));
app.use(express.json());

// ============ DATABASE CONNECTION ============
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306')
});

db.connect((err) => {
    if(err) {
        console.error('❌ DB Connection Failed:', err.message);
        console.error('Connection details:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });
        return;
    }
    console.log('✅ Connected to MySQL Database successfully!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    db.query('SELECT 1', (err, result) => {
        if(err) {
            res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
        } else {
            res.json({ status: 'healthy', database: 'connected', timestamp: new Date() });
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'TaskFlow Pro API is running', status: 'online' });
});

// ============ EMAIL CONFIGURATION ============
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ============ UNIQUE ID GENERATION FUNCTIONS ============

const generateStudentId = async () => {
    return new Promise((resolve, reject) => {
        const currentYear = new Date().getFullYear();
        const prefix = `S${currentYear}`;
        
        const query = "SELECT unique_id FROM users WHERE unique_id LIKE ? ORDER BY unique_id DESC LIMIT 1";
        db.query(query, [`${prefix}%`], (err, results) => {
            if(err) return reject(err);
            
            let nextNumber = 1;
            if(results.length > 0) {
                const lastId = results[0].unique_id;
                const lastNumber = parseInt(lastId.slice(-5));
                nextNumber = lastNumber + 1;
            }
            
            const newId = `${prefix}${String(nextNumber).padStart(5, '0')}`;
            resolve(newId);
        });
    });
};

const generateAdminId = async () => {
    return new Promise((resolve, reject) => {
        const currentYear = new Date().getFullYear();
        const prefix = `P${currentYear}`;
        
        const query = "SELECT unique_id FROM users WHERE unique_id LIKE ? ORDER BY unique_id DESC LIMIT 1";
        db.query(query, [`${prefix}%`], (err, results) => {
            if(err) return reject(err);
            
            let nextNumber = 1;
            if(results.length > 0) {
                const lastId = results[0].unique_id;
                const lastNumber = parseInt(lastId.slice(-5));
                nextNumber = lastNumber + 1;
            }
            
            const newId = `${prefix}${String(nextNumber).padStart(5, '0')}`;
            resolve(newId);
        });
    });
};

const updateUserIdOnPromotion = async (userId, newRole) => {
    return new Promise((resolve, reject) => {
        if(newRole === 'admin') {
            generateAdminId().then(newId => {
                const query = "UPDATE users SET unique_id = ?, role = ? WHERE id = ?";
                db.query(query, [newId, newRole, userId], (err) => {
                    if(err) return reject(err);
                    resolve(newId);
                });
            }).catch(reject);
        } else {
            resolve(null);
        }
    });
};

// ============ EMAIL VERIFICATION FUNCTIONS ============

const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const sendVerificationEmail = async (email, fullname, token) => {
    const verificationUrl = `https://taskflow-pro-production-acce.up.railway.app/verify-email?token=${token}`;
    
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - TaskFlow Pro',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Welcome, ${fullname}!</h2>
                    <p>Please verify your email address to activate your account.</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background: #0a2463; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    </div>
                    <p>Or copy this link: ${verificationUrl}</p>
                    <p style="font-size: 12px; color: #666;">This link expires in 24 hours.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">If you didn't create an account, please ignore this email.</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Verification email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Verification email failed:", err);
        return false;
    }
};

const sendWelcomeEmail = async (email, fullname, uniqueId) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Welcome to TaskFlow Pro - Account Verified',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Welcome, ${fullname}!</h2>
                    <p>Your email has been verified successfully!</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #333;"><strong>🔑 Your Unique ID:</strong></p>
                        <p style="font-size: 24px; font-weight: bold; color: #0a2463; margin: 10px 0; letter-spacing: 2px;">${uniqueId}</p>
                        <p style="margin: 0; font-size: 12px; color: #666;">Use this ID to login to your account</p>
                    </div>
                    <p>Login URL: https://taskflow-pro-production-acce.up.railway.app</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Welcome email sent to ${email} with ID: ${uniqueId}`);
        return true;
    } catch (err) {
        console.error("❌ Welcome email failed:", err);
        return false;
    }
};

const sendNoticeEmail = async (email, fullname, title, message, priority, adminName) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `📢 New Announcement: ${title}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>New Announcement</h2>
                    <p>Hello ${fullname},</p>
                    <p><strong>${adminName}</strong> has posted a new announcement:</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="font-size: 16px; font-weight: bold; color: #0a2463;">${title}</p>
                        <p style="color: #333;">${message}</p>
                        <p style="margin-top: 10px;"><strong>Priority:</strong> ${priority}</p>
                    </div>
                    <p>Login to view full details.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Notice email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Notice email failed:", err);
        return false;
    }
};

const sendTaskAssignedEmail = async (email, fullname, taskTitle, priority, deadline, adminName) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `📋 New Task Assigned: ${taskTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>New Task Assigned</h2>
                    <p>Hello ${fullname},</p>
                    <p>A new task has been assigned to you by <strong>${adminName}</strong>.</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="font-size: 16px; font-weight: bold; color: #0a2463;">${taskTitle}</p>
                        <p><strong>Priority:</strong> ${priority}</p>
                        <p><strong>Due Date:</strong> ${deadline || 'Not specified'}</p>
                    </div>
                    <p>Login to view and manage this task.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Task assignment email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Task assignment email failed:", err);
        return false;
    }
};

const sendAccountTerminationEmail = async (email, fullname, adminName) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '⚠️ Account Termination Notice',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #c62828; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2 style="color: #c62828;">Account Termination Notice</h2>
                    <p>Hello ${fullname},</p>
                    <p>Your TaskFlow account has been <strong>terminated</strong> by <strong>${adminName}</strong>.</p>
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p>All your tasks and data have been removed from the system.</p>
                    </div>
                    <p>If you believe this was a mistake, please contact your system administrator.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Account termination email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Termination email failed:", err);
        return false;
    }
};

const sendPromotionEmail = async (email, fullname, newId, adminName) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '👑 You have been promoted to Administrator',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Congratulations! You are now an Administrator</h2>
                    <p>Hello ${fullname},</p>
                    <p>You have been promoted to <strong>Administrator</strong> by <strong>${adminName}</strong>.</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Your New Unique ID:</strong> ${newId}</p>
                    </div>
                    <p>Your new role gives you access to:</p>
                    <ul>
                        <li>Admin Panel</li>
                        <li>User Management</li>
                        <li>Send Announcements</li>
                        <li>View all tasks</li>
                    </ul>
                    <p>Login to access your new privileges.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Promotion email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Promotion email failed:", err);
        return false;
    }
};

const sendTaskStatusUpdateEmail = async (email, fullname, taskTitle, oldStatus, newStatus, adminName) => {
    const mailOptions = {
        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🔄 Task Status Updated: ${taskTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                </div>
                <div style="padding: 20px;">
                    <h2>Task Status Updated</h2>
                    <p>Hello ${fullname},</p>
                    <p>The status of your task has been updated by <strong>${adminName}</strong>.</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="font-size: 16px; font-weight: bold; color: #0a2463;">${taskTitle}</p>
                        <p><strong>Old Status:</strong> ${oldStatus}</p>
                        <p><strong>New Status:</strong> ${newStatus}</p>
                    </div>
                    <p>Login to view the updated task.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            </div>
        `
    };
    
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Task status update email sent to ${email}`);
        return true;
    } catch (err) {
        console.error("❌ Task status update email failed:", err);
        return false;
    }
};

// ============ AUTHENTICATION APIs ============

app.post("/signup", async (req, res) => {
    const { fullname, username, email, password, about } = req.body;
    const role = 'user';
    const verificationToken = generateVerificationToken();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);
    
    const checkEmail = "SELECT id FROM users WHERE email = ?";
    db.query(checkEmail, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length > 0) {
            return res.status(400).json({ error: "Email already registered. Please login." });
        }
        
        try {
            const uniqueId = await generateStudentId();
            
            const query = `INSERT INTO users 
                (fullname, username, email, password, about, role, unique_id, 
                 is_verified, verification_token, token_expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            db.query(query, [
                fullname, username, email, password, about, role, uniqueId,
                false, verificationToken, tokenExpiry
            ], async (err, result) => {
                if(err) {
                    return res.status(500).json({ error: err.message });
                }
                
                await sendVerificationEmail(email, fullname, verificationToken);
                
                res.json({ 
                    message: "Account created! Please check your email to verify your account.", 
                    userId: result.insertId,
                    uniqueId: uniqueId,
                    requiresVerification: true
                });
            });
        } catch(err) {
            res.status(500).json({ error: err.message });
        }
    });
});

app.post("/login", (req, res) => {
    const { unique_id, password } = req.body;
    
    const query = "SELECT * FROM users WHERE unique_id = ? AND password = ?";
    
    db.query(query, [unique_id, password], (err, results) => {
        if(err) {
            return res.status(500).json({ error: err.message });
        }
        if(results.length === 0) {
            return res.status(401).json({ error: "Invalid Unique ID or Password" });
        }
        
        const user = results[0];
        
        if (user.is_verified === 0) {
            if (user.token_expires_at && new Date() > new Date(user.token_expires_at)) {
                return res.status(401).json({ 
                    error: "Verification link expired. Please request a new verification email.",
                    needsNewToken: true,
                    userId: user.id,
                    email: user.email
                });
            }
            
            return res.status(401).json({ 
                error: "Please verify your email before logging in. Check your inbox for the verification link.",
                requiresVerification: true,
                email: user.email,
                userId: user.id
            });
        }
        
        res.json({
            id: user.id,
            unique_id: user.unique_id,
            fullname: user.fullname,
            username: user.username,
            email: user.email,
            about: user.about,
            role: user.role,
            isVerified: user.is_verified === 1
        });
    });
});

app.post("/forgot-id", async (req, res) => {
    const { email } = req.body;
    
    const query = "SELECT fullname, unique_id FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        if(results.length === 0) {
            return res.status(404).json({ error: "No account found with this email" });
        }
        
        const user = results[0];
        
        const mailOptions = {
            from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your TaskFlow Unique ID',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #0a2463;">Your Unique ID</h2>
                    <p>Hello ${user.fullname},</p>
                    <p>Your TaskFlow Unique ID is:</p>
                    <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; text-align: center;">
                        <p style="font-size: 28px; font-weight: bold; color: #0a2463; letter-spacing: 2px;">${user.unique_id}</p>
                    </div>
                    <p>Use this ID to login to your account.</p>
                    <hr>
                    <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                </div>
            `
        };
        
        try {
            await transporter.sendMail(mailOptions);
            res.json({ message: "Your Unique ID has been sent to your email" });
        } catch(err) {
            res.status(500).json({ error: "Failed to send email" });
        }
    });
});

app.get("/verify-email", (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
    }
    
    db.query(
        "SELECT * FROM users WHERE verification_token = ? AND token_expires_at > NOW()",
        [token],
        (err, results) => {
            if (err) {
                console.error("Verification error:", err);
                return res.status(500).json({ error: err.message });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ 
                    error: "Invalid or expired verification token. Please request a new one."
                });
            }
            
            const user = results[0];
            
            if (user.is_verified === 1) {
                return res.json({ 
                    message: "Email already verified. You can now login.", 
                    verified: true,
                    email: user.email 
                });
            }
            
            db.query(
                "UPDATE users SET is_verified = 1, verification_token = NULL, token_expires_at = NULL, verified_at = NOW() WHERE id = ?",
                [user.id],
                (err) => {
                    if (err) {
                        console.error("Update error:", err);
                        return res.status(500).json({ error: err.message });
                    }
                    
                    sendWelcomeEmail(user.email, user.fullname, user.unique_id);
                    
                    res.json({ 
                        message: "Email verified successfully! Your Unique ID has been sent to your email.",
                        verified: true,
                        email: user.email,
                        fullname: user.fullname
                    });
                }
            );
        }
    );
});

app.post("/resend-verification", async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }
    
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(404).json({ error: "No account found with this email" });
        }
        
        const user = results[0];
        
        if (user.is_verified === 1) {
            return res.status(400).json({ error: "Email already verified. You can login." });
        }
        
        const newToken = generateVerificationToken();
        const newExpiry = new Date();
        newExpiry.setHours(newExpiry.getHours() + 24);
        
        db.query(
            "UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?",
            [newToken, newExpiry, user.id],
            async (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                await sendVerificationEmail(user.email, user.fullname, newToken);
                
                res.json({ 
                    message: "New verification email sent! Please check your inbox."
                });
            }
        );
    });
});

// ============ FORGOT PASSWORD APIs ============

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }
    
    const query = "SELECT id, fullname, email FROM users WHERE email = ?";
    db.query(query, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.json({ message: "If an account exists with this email, a password reset link has been sent." });
        }
        
        const user = results[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date();
        tokenExpiry.setHours(tokenExpiry.getHours() + 1);
        
        db.query(
            "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
            [resetToken, tokenExpiry, user.id],
            async (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                const resetUrl = `https://taskflow-pro-production-acce.up.railway.app/reset-password?token=${resetToken}`;
                
                const mailOptions = {
                    from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Reset Your Password - TaskFlow Pro',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <div style="text-align: center; background: #0a2463; padding: 20px; border-radius: 10px 10px 0 0;">
                                <h1 style="color: white; margin: 0;">TaskFlow Pro</h1>
                            </div>
                            <div style="padding: 20px;">
                                <h2>Password Reset Request</h2>
                                <p>Hello ${user.fullname},</p>
                                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                                <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0a2463; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                                </div>
                                <p>Or copy this link: ${resetUrl}</p>
                                <p style="font-size: 12px; color: #666;">This link expires in 1 hour.</p>
                                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                                <p style="font-size: 12px; color: #999;">If you didn't request this, please ignore this email.</p>
                            </div>
                        </div>
                    `
                };
                
                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`📧 Password reset email sent to ${email}`);
                    res.json({ message: "If an account exists with this email, a password reset link has been sent." });
                } catch (err) {
                    console.error("❌ Reset email failed:", err);
                    res.status(500).json({ error: "Failed to send reset email" });
                }
            }
        );
    });
});

app.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
    }
    
    if (newPassword.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    
    db.query(
        "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires_at > NOW()",
        [token],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (results.length === 0) {
                return res.status(404).json({ error: "Invalid or expired reset token. Please request a new one." });
            }
            
            const user = results[0];
            
            db.query(
                "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?",
                [newPassword, user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    const mailOptions = {
                        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                        to: user.email,
                        subject: 'Password Reset Successful - TaskFlow Pro',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                                <h2>Password Reset Successful</h2>
                                <p>Hello ${user.fullname},</p>
                                <p>Your password has been successfully reset.</p>
                                <p>If you did not perform this action, please contact support immediately.</p>
                                <hr>
                                <p style="font-size: 12px; color: #999;">TaskFlow Support Team</p>
                            </div>
                        `
                    };
                    
                    transporter.sendMail(mailOptions).catch(console.error);
                    
                    res.json({ message: "Password reset successfully! You can now login with your new password." });
                }
            );
        }
    );
});

// ============ USER MANAGEMENT APIs ============

app.get("/users", (req, res) => {
    const { adminId } = req.query;
    
    db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        if(results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        db.query("SELECT id, unique_id, fullname, username, email, about, role, is_verified FROM users", (err, users) => {
            if(err) return res.status(500).json({ error: err.message });
            res.json(users);
        });
    });
});

app.put("/users/:id", (req, res) => {
    const { fullname, username, email, about, password } = req.body;
    const userId = req.params.id;
    
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        if(results.length === 0) return res.status(404).json({ error: "User not found" });
        
        let query = "UPDATE users SET fullname = ?, username = ?, email = ?, about = ?";
        let params = [fullname, username, email, about || ''];
        
        if (password && password.trim() !== '') {
            query += ", password = ?";
            params.push(password);
        }
        
        query += " WHERE id = ?";
        params.push(userId);
        
        db.query(query, params, (err) => {
            if(err) return res.status(500).json({ error: err.message });
            res.json({ message: "Profile updated successfully" });
        });
    });
});

app.put("/users/:id/make-admin", async (req, res) => {
    const { adminId } = req.body;
    const userId = req.params.id;
    
    db.query("SELECT fullname FROM users WHERE id = ?", [adminId], (err, adminResult) => {
        if(err) return res.status(500).json({ error: err.message });
        const adminName = adminResult[0]?.fullname || 'Administrator';
        
        db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
            if(err) return res.status(500).json({ error: err.message });
            if(results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ error: "Unauthorized: Admin only" });
            }
            
            updateUserIdOnPromotion(userId, 'admin').then(async (newId) => {
                db.query("SELECT * FROM users WHERE id = ?", [userId], async (err, userResults) => {
                    if(err) return res.status(500).json({ error: err.message });
                    const promotedUser = userResults[0];
                    
                    await sendPromotionEmail(promotedUser.email, promotedUser.fullname, newId, adminName);
                    
                    res.json({ 
                        message: "User promoted to admin", 
                        newId: newId,
                        user: promotedUser
                    });
                });
            }).catch(err => {
                res.status(500).json({ error: err.message });
            });
        });
    });
});

app.delete("/users/:id", (req, res) => {
    const { adminId } = req.body;
    const userId = req.params.id;
    
    if (!adminId) {
        return res.status(400).json({ error: "adminId is required" });
    }
    
    db.query("SELECT fullname, role FROM users WHERE id = ?", [adminId], (err, adminResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (adminResult.length === 0 || adminResult[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        const adminName = adminResult[0].fullname;
        
        db.query("SELECT * FROM users WHERE id = ?", [userId], (err, userResult) => {
            if (err) return res.status(500).json({ error: err.message });
            if (userResult.length === 0) return res.status(404).json({ error: "User not found" });
            
            const deletedUser = userResult[0];
            
            if (deletedUser.id === parseInt(adminId)) {
                return res.status(400).json({ error: "You cannot delete your own account" });
            }
            
            db.query("DELETE FROM notice_recipients WHERE user_id = ?", [userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                db.query("DELETE FROM tasks WHERE created_by = ?", [userId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    db.query("UPDATE notices SET created_by = NULL WHERE created_by = ?", [userId], (err) => {
                        if (err) console.log("⚠️ Notice update warning:", err.message);
                        
                        db.query("DELETE FROM users WHERE id = ?", [userId], async (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            
                            if (deletedUser.email) {
                                await sendAccountTerminationEmail(deletedUser.email, deletedUser.fullname, adminName);
                            }
                            
                            res.json({ message: "User deleted successfully" });
                        });
                    });
                });
            });
        });
    });
});

// ============ TASK APIs ============

app.get("/tasks", (req, res) => {
    const { userId, userRole } = req.query;
    
    let query;
    let params;
    
    if(userRole === 'admin') {
        query = `
            SELECT 
                t.*, 
                u.fullname as created_by_name,
                u.unique_id as created_by_unique_id,
                a.fullname as assigned_by_name,
                CASE 
                    WHEN t.assigned_by = t.created_by THEN 'Self Assigned'
                    ELSE CONCAT('Assigned by ', a.fullname)
                END as assignment_info
            FROM tasks t 
            LEFT JOIN users u ON t.created_by = u.id
            LEFT JOIN users a ON t.assigned_by = a.id
            ORDER BY t.deadline ASC
        `;
        params = [];
    } else {
        query = `
            SELECT 
                t.*, 
                a.fullname as assigned_by_name,
                CASE 
                    WHEN t.assigned_by = t.created_by THEN 'Self Assigned'
                    ELSE CONCAT('Assigned by ', a.fullname)
                END as assignment_info
            FROM tasks t 
            LEFT JOIN users a ON t.assigned_by = a.id
            WHERE t.created_by = ? 
            ORDER BY t.deadline ASC
        `;
        params = [userId];
    }
    
    db.query(query, params, (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post("/tasks", async (req, res) => {
    const { title, description, priority, deadline, created_by, assigned_by, status, progress } = req.body;
    const taskStatus = status || "pending";
    const taskProgress = progress || 0;
    
    const query = `INSERT INTO tasks 
        (title, description, priority, deadline, status, created_by, assigned_by, assigned_at, progress) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`;
    
    db.query(query, [title, description, priority, deadline, taskStatus, created_by, assigned_by || created_by, taskProgress], async (err, result) => {
        if(err) return res.status(500).json({ error: err.message });
        
        if (assigned_by && assigned_by !== created_by) {
            db.query("SELECT fullname, email FROM users WHERE id = ?", [created_by], async (err, userResults) => {
                if (!err && userResults.length > 0) {
                    const assignedUser = userResults[0];
                    db.query("SELECT fullname FROM users WHERE id = ?", [assigned_by], async (err, adminResults) => {
                        const adminName = (adminResults && adminResults.length > 0) ? adminResults[0].fullname : 'Administrator';
                        await sendTaskAssignedEmail(assignedUser.email, assignedUser.fullname, title, priority, deadline || 'Not specified', adminName);
                    });
                }
            });
        }
        
        res.json({ message: "Task created", taskId: result.insertId });
    });
});

app.put("/tasks/:id", async (req, res) => {
    const { title, description, priority, deadline, status, progress } = req.body;
    const taskId = req.params.id;
    
    let query = "UPDATE tasks SET title = ?, description = ?, priority = ?, deadline = ?, status = ?";
    let params = [title, description, priority, deadline, status];
    
    if (progress !== undefined) {
        query += ", progress = ?";
        params.push(progress);
    }
    
    query += " WHERE id = ?";
    params.push(taskId);
    
    db.query(query, params, (err, result) => {
        if(err) return res.status(500).json({ error: err.message });
        if(result.affectedRows === 0) return res.status(404).json({ error: "Task not found" });
        res.json({ message: "Task updated", taskId: taskId });
    });
});

app.put("/tasks/:id/status", async (req, res) => {
    const { status, progress } = req.body;
    const taskId = req.params.id;
    
    db.query("SELECT * FROM tasks WHERE id = ?", [taskId], async (err, oldTaskResult) => {
        if(err) return res.status(500).json({ error: err.message });
        const oldTask = oldTaskResult[0];
        if (!oldTask) return res.status(404).json({ error: "Task not found" });
        
        let query = "UPDATE tasks SET status = ?";
        let params = [status];
        
        if (progress !== undefined && progress !== null) {
            query += ", progress = ?";
            params.push(progress);
        }
        
        if (status === 'completed' && oldTask.status !== 'completed') {
            query += ", completed_at = NOW()";
        }
        
        query += " WHERE id = ?";
        params.push(taskId);
        
        db.query(query, params, async (err, result) => {
            if(err) {
                console.error("❌ Status update error:", err);
                return res.status(500).json({ error: err.message });
            }
            if(result.affectedRows === 0) return res.status(404).json({ error: "Task not found" });
            
            if (status === 'completed' && oldTask.status !== 'completed') {
                const assignedToUser = oldTask.created_by;
                const assignedByAdmin = oldTask.assigned_by;
                
                if (assignedByAdmin && assignedByAdmin !== assignedToUser) {
                    db.query("SELECT fullname, email FROM users WHERE id = ?", [assignedByAdmin], async (err, adminResults) => {
                        if (!err && adminResults.length > 0) {
                            const admin = adminResults[0];
                            db.query("SELECT fullname FROM users WHERE id = ?", [assignedToUser], async (err, userResults) => {
                                const userName = (userResults && userResults.length > 0) ? userResults[0].fullname : 'A user';
                                await sendTaskStatusUpdateEmail(admin.email, admin.fullname, oldTask.title, oldTask.status, 'Completed', userName);
                            });
                        }
                    });
                }
            }
            
            res.json({ message: "Task status updated", taskId: taskId, newStatus: status, progress: progress });
        });
    });
});

app.delete("/tasks/:id", (req, res) => {
    const taskId = req.params.id;
    
    db.query("DELETE FROM tasks WHERE id = ?", [taskId], (err, result) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: "Task deleted" });
    });
});

// ============ NOTICE APIs ============

app.post("/notices", async (req, res) => {
    const { title, message, priority, expires_at, recipient_users, sendToAll } = req.body;
    const created_by = req.body.adminId;
    
    db.query("SELECT role, fullname FROM users WHERE id = ?", [created_by], async (err, adminResults) => {
        if(err) return res.status(500).json({ error: err.message });
        if(adminResults.length === 0 || adminResults[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        const adminName = adminResults[0].fullname;
        const priorityText = priority === 'high' ? '🔴 High Priority' : priority === 'medium' ? '🟡 Medium Priority' : '🟢 Low Priority';
        
        const insertNotice = "INSERT INTO notices (title, message, priority, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
        db.query(insertNotice, [title, message, priority, created_by, expires_at || null], async (err, noticeResult) => {
            if(err) return res.status(500).json({ error: err.message });
            
            const noticeId = noticeResult.insertId;
            
            if (sendToAll) {
                db.query("SELECT id, fullname, email FROM users", async (err, users) => {
                    if(err) return res.status(500).json({ error: err.message });
                    
                    const recipientValues = users.map(u => [noticeId, u.id, false, null]);
                    const insertRecipients = "INSERT INTO notice_recipients (notice_id, user_id, is_read, read_at) VALUES ?";
                    db.query(insertRecipients, [recipientValues], async (err) => {
                        if(err) return res.status(500).json({ error: err.message });
                        
                        for (const user of users) {
                            await sendNoticeEmail(user.email, user.fullname, title, message, priorityText, adminName);
                        }
                        
                        res.json({ message: "Notice sent to all users!", noticeId: noticeId });
                    });
                });
            } else if (recipient_users && recipient_users.length > 0) {
                db.query("SELECT id, fullname, email FROM users WHERE id IN (?)", [recipient_users], async (err, users) => {
                    if(err) return res.status(500).json({ error: err.message });
                    
                    const recipientValues = recipient_users.map(userId => [noticeId, userId, false, null]);
                    const insertRecipients = "INSERT INTO notice_recipients (notice_id, user_id, is_read, read_at) VALUES ?";
                    db.query(insertRecipients, [recipientValues], async (err) => {
                        if(err) return res.status(500).json({ error: err.message });
                        
                        for (const user of users) {
                            await sendNoticeEmail(user.email, user.fullname, title, message, priorityText, adminName);
                        }
                        
                        res.json({ message: `Notice sent to ${recipient_users.length} users!`, noticeId: noticeId });
                    });
                });
            } else {
                res.json({ message: "Notice created but no recipients selected", noticeId: noticeId });
            }
        });
    });
});

app.get("/notices", (req, res) => {
    const { userId } = req.query;
    
    const query = `
        SELECT n.*, nr.is_read, nr.read_at,
               CASE 
                   WHEN n.priority = 'high' THEN 'high'
                   WHEN n.priority = 'medium' THEN 'medium'
                   ELSE 'low'
               END as priority_level
        FROM notices n
        JOIN notice_recipients nr ON n.id = nr.notice_id
        WHERE nr.user_id = ?
        ORDER BY n.created_at DESC
    `;
    
    db.query(query, [userId], (err, notices) => {
        if(err) return res.status(500).json({ error: err.message });
        
        const unreadQuery = "SELECT COUNT(*) as unread FROM notice_recipients WHERE user_id = ? AND is_read = FALSE";
        db.query(unreadQuery, [userId], (err, countResult) => {
            if(err) return res.status(500).json({ error: err.message });
            res.json({ 
                notices: notices || [],
                unreadCount: countResult[0]?.unread || 0
            });
        });
    });
});

app.put("/notices/:id/read", (req, res) => {
    const { userId } = req.body;
    const noticeId = req.params.id;
    
    const query = "UPDATE notice_recipients SET is_read = TRUE, read_at = NOW() WHERE notice_id = ? AND user_id = ?";
    db.query(query, [noticeId, userId], (err) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ message: "Notice marked as read" });
    });
});

app.delete("/notices/:id", (req, res) => {
    const { adminId } = req.body;
    const noticeId = req.params.id;
    
    db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        if(results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        db.query("DELETE FROM notices WHERE id = ?", [noticeId], (err) => {
            if(err) return res.status(500).json({ error: err.message });
            res.json({ message: "Notice deleted successfully" });
        });
    });
});

// ============ TASK COMMENTS & NOTIFICATIONS APIs ============

app.get("/tasks/:taskId/comments", (req, res) => {
    const { taskId } = req.params;
    const { userId } = req.query;
    
    const query = `
        SELECT 
            c.*,
            u.fullname as user_name,
            u.unique_id as user_unique_id,
            u.email as user_email,
            u.role as user_role
        FROM task_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at ASC
    `;
    
    db.query(query, [taskId], (err, comments) => {
        if (err) {
            console.error("Error fetching comments:", err);
            return res.status(500).json({ error: err.message });
        }
        
        if (userId) {
            db.query(
                "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND related_id = ? AND type = 'mention'",
                [userId, taskId],
                (err) => {}
            );
        }
        
        res.json(comments || []);
    });
});

app.post("/tasks/:taskId/comments", async (req, res) => {
    const { taskId } = req.params;
    const { userId, comment, parentCommentId, userName } = req.body;
    
    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: "Comment cannot be empty" });
    }
    
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(comment)) !== null) {
        mentions.push(match[1]);
    }
    
    const mentionedUsersJson = mentions.length > 0 ? JSON.stringify(mentions) : null;
    
    const query = `
        INSERT INTO task_comments (task_id, user_id, comment, parent_comment_id, mentioned_users)
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(query, [taskId, userId, comment, parentCommentId || null, mentionedUsersJson], async (err, result) => {
        if (err) {
            console.error("Error adding comment:", err);
            return res.status(500).json({ error: err.message });
        }
        
        db.query("SELECT title, created_by FROM tasks WHERE id = ?", [taskId], async (err, taskResult) => {
            if (err) return;
            
            const task = taskResult[0];
            
            if (mentions.length > 0) {
                const placeholders = mentions.map(() => '?').join(',');
                db.query(
                    `SELECT id, fullname, email, username FROM users WHERE username IN (${placeholders})`,
                    mentions,
                    async (err, mentionedUsers) => {
                        if (err) return;
                        
                        for (const mentionedUser of mentionedUsers) {
                            if (mentionedUser.id === userId) continue;
                            
                            db.query(
                                `INSERT INTO notifications (user_id, type, title, message, related_id)
                                 VALUES (?, 'mention', ?, ?, ?)`,
                                [
                                    mentionedUser.id,
                                    `Mentioned in "${task.title}"`,
                                    `${userName || 'Someone'} mentioned you in a comment: "${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}"`,
                                    taskId
                                ],
                                (err) => {}
                            );
                            
                            db.query("SELECT fullname, email FROM users WHERE id = ?", [userId], (err, commenterResult) => {
                                if (err || !commenterResult[0]) return;
                                
                                const commenter = commenterResult[0];
                                const sendMentionEmail = async (email, fullname, mentionedBy, taskTitle, comment, taskId) => {
                                    const mailOptions = {
                                        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                                        to: email,
                                        subject: `📢 You were mentioned in a task - ${taskTitle}`,
                                        html: `<p>${mentionedBy} mentioned you: "${comment}"</p>`
                                    };
                                    try { await transporter.sendMail(mailOptions); } catch(e) {}
                                };
                                sendMentionEmail(mentionedUser.email, mentionedUser.fullname, commenter.fullname, task.title, comment, taskId);
                            });
                        }
                    }
                );
            }
            
            db.query(`
                SELECT c.*, u.fullname as user_name, u.unique_id as user_unique_id, u.role as user_role
                FROM task_comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = ?
            `, [result.insertId], (err, commentResult) => {
                res.json({ 
                    message: "Comment added successfully", 
                    comment: commentResult[0] 
                });
            });
        });
    });
});

app.delete("/comments/:commentId", (req, res) => {
    const { commentId } = req.params;
    const { userId, userRole } = req.body;
    
    const checkQuery = `SELECT user_id FROM task_comments WHERE id = ?`;
    
    db.query(checkQuery, [commentId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Comment not found" });
        
        const comment = results[0];
        const isOwner = comment.user_id === userId;
        const isAdmin = userRole === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: "Unauthorized to delete this comment" });
        }
        
        db.query("DELETE FROM task_comments WHERE id = ?", [commentId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Comment deleted successfully" });
        });
    });
});

app.put("/comments/:commentId", (req, res) => {
    const { commentId } = req.params;
    const { userId, comment } = req.body;
    
    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: "Comment cannot be empty" });
    }
    
    db.query("SELECT user_id FROM task_comments WHERE id = ?", [commentId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Comment not found" });
        if (results[0].user_id !== userId) {
            return res.status(403).json({ error: "Unauthorized to edit this comment" });
        }
        
        db.query("UPDATE task_comments SET comment = ? WHERE id = ?", [comment, commentId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Comment updated successfully" });
        });
    });
});

app.get("/notifications", (req, res) => {
    const { userId } = req.query;
    
    const query = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
    `;
    
    db.query(query, [userId], (err, notifications) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const unreadQuery = "SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = FALSE";
        db.query(unreadQuery, [userId], (err, countResult) => {
            res.json({
                notifications: notifications || [],
                unreadCount: countResult[0]?.unread || 0
            });
        });
    });
});

app.put("/notifications/:id/read", (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    
    db.query("UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?", [id, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Notification marked as read" });
    });
});

app.put("/notifications/read-all", (req, res) => {
    const { userId } = req.body;
    
    db.query("UPDATE notifications SET is_read = TRUE WHERE user_id = ?", [userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "All notifications marked as read" });
    });
});

// ============ TEAM APIs ============

app.post("/teams", async (req, res) => {
    const { name, description, memberIds, adminId } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: "Team name is required" });
    }
    
    db.query("SELECT role, fullname FROM users WHERE id = ?", [adminId], (err, adminResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (adminResult.length === 0 || adminResult[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        const adminName = adminResult[0].fullname;
        
        db.query("INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)", 
            [name, description || '', adminId], 
            (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                
                const teamId = result.insertId;
                
                db.query("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'lead')", 
                    [teamId, adminId], 
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        
                        if (memberIds && memberIds.length > 0) {
                            const memberValues = memberIds.map(userId => [teamId, userId, 'member']);
                            db.query("INSERT INTO team_members (team_id, user_id, role) VALUES ?", 
                                [memberValues], 
                                async (err) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    
                                    for (const userId of memberIds) {
                                        db.query("SELECT email, fullname FROM users WHERE id = ?", [userId], async (err, userResult) => {
                                            if (!err && userResult.length > 0) {
                                                const sendTeamAddedEmail = async (email, fullname, teamName, adminName) => {
                                                    const mailOptions = {
                                                        from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                                                        to: email,
                                                        subject: `👥 You've been added to a team - ${teamName}`,
                                                        html: `<p>You've been added to ${teamName} by ${adminName}</p>`
                                                    };
                                                    try { await transporter.sendMail(mailOptions); } catch(e) {}
                                                };
                                                await sendTeamAddedEmail(userResult[0].email, userResult[0].fullname, name, adminName);
                                            }
                                        });
                                    }
                                    
                                    res.json({ message: "Team created successfully", teamId: teamId });
                                });
                        } else {
                            res.json({ message: "Team created successfully", teamId: teamId });
                        }
                    });
            });
    });
});

app.get("/teams/my-teams", (req, res) => {
    const { userId } = req.query;
    
    const query = `
        SELECT t.*, 
               COUNT(DISTINCT tm.user_id) as member_count,
               (SELECT role FROM team_members WHERE team_id = t.id AND user_id = ?) as user_role
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
        GROUP BY t.id
        ORDER BY t.created_at DESC
    `;
    
    db.query(query, [userId, userId], (err, teams) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(teams);
    });
});

app.get("/teams/all", (req, res) => {
    const { adminId } = req.query;
    
    db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        const query = `
            SELECT t.*, 
                   u.fullname as created_by_name,
                   COUNT(DISTINCT tm.user_id) as member_count
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN users u ON t.created_by = u.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        `;
        
        db.query(query, (err, teams) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(teams);
        });
    });
});

app.get("/teams/:teamId", (req, res) => {
    const { teamId } = req.params;
    const { userId } = req.query;
    
    db.query("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId], (err, memberCheck) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query("SELECT role FROM users WHERE id = ?", [userId], (err, userResult) => {
            const isAdmin = userResult && userResult[0]?.role === 'admin';
            
            if (!isAdmin && memberCheck.length === 0) {
                return res.status(403).json({ error: "Unauthorized: Not a team member" });
            }
            
            db.query("SELECT * FROM teams WHERE id = ?", [teamId], (err, teamResult) => {
                if (err) return res.status(500).json({ error: err.message });
                if (teamResult.length === 0) return res.status(404).json({ error: "Team not found" });
                
                db.query(`
                    SELECT u.id, u.fullname, u.username, u.email, u.role, tm.role as team_role, tm.joined_at
                    FROM team_members tm
                    JOIN users u ON tm.user_id = u.id
                    WHERE tm.team_id = ?
                    ORDER BY tm.role DESC, u.fullname ASC
                `, [teamId], (err, members) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    res.json({
                        team: teamResult[0],
                        members: members,
                        userRole: memberCheck[0]?.role || null
                    });
                });
            });
        });
    });
});

app.get("/teams/:teamId/tasks", (req, res) => {
    const { teamId } = req.params;
    const { userId } = req.query;
    
    db.query("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId], (err, memberCheck) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query("SELECT role FROM users WHERE id = ?", [userId], (err, userResult) => {
            const isAdmin = userResult && userResult[0]?.role === 'admin';
            
            if (!isAdmin && memberCheck.length === 0) {
                return res.status(403).json({ error: "Unauthorized: Not a team member" });
            }
            
            const query = `
                SELECT t.*, 
                       u.fullname as created_by_name,
                       u.unique_id as created_by_unique_id,
                       a.fullname as assigned_by_name
                FROM tasks t
                LEFT JOIN users u ON t.created_by = u.id
                LEFT JOIN users a ON t.assigned_by = a.id
                WHERE t.team_id = ?
                ORDER BY t.deadline ASC, t.created_at DESC
            `;
            
            db.query(query, [teamId], (err, tasks) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(tasks);
            });
        });
    });
});

app.post("/teams/:teamId/members", async (req, res) => {
    const { teamId } = req.params;
    const { userId, adminId } = req.body;
    
    db.query("SELECT role, fullname FROM users WHERE id = ?", [adminId], (err, adminResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (adminResult.length === 0 || adminResult[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        const adminName = adminResult[0].fullname;
        
        db.query("SELECT name FROM teams WHERE id = ?", [teamId], (err, teamResult) => {
            if (err) return res.status(500).json({ error: err.message });
            if (teamResult.length === 0) return res.status(404).json({ error: "Team not found" });
            
            const teamName = teamResult[0].name;
            
            db.query("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')", 
                [teamId, userId], 
                async (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    db.query("SELECT email, fullname FROM users WHERE id = ?", [userId], async (err, userResult) => {
                        if (!err && userResult.length > 0) {
                            const sendTeamAddedEmail = async (email, fullname, teamName, adminName) => {
                                const mailOptions = {
                                    from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                                    to: email,
                                    subject: `👥 You've been added to a team - ${teamName}`,
                                    html: `<p>You've been added to ${teamName} by ${adminName}</p>`
                                };
                                try { await transporter.sendMail(mailOptions); } catch(e) {}
                            };
                            await sendTeamAddedEmail(userResult[0].email, userResult[0].fullname, teamName, adminName);
                        }
                    });
                    
                    res.json({ message: "Member added successfully" });
                });
        });
    });
});

app.delete("/teams/:teamId/members/:userId", (req, res) => {
    const { teamId, userId } = req.params;
    const { adminId } = req.body;
    
    db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        db.query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Member removed successfully" });
        });
    });
});

app.delete("/teams/:teamId", (req, res) => {
    const { teamId } = req.params;
    const { adminId } = req.body;
    
    db.query("SELECT role FROM users WHERE id = ?", [adminId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || results[0].role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized: Admin only" });
        }
        
        db.query("DELETE FROM teams WHERE id = ?", [teamId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Team deleted successfully" });
        });
    });
});

app.post("/teams/:teamId/tasks", async (req, res) => {
    const { teamId } = req.params;
    const { title, description, priority, deadline, created_by, assigned_by, adminId } = req.body;
    
    db.query("SELECT role, fullname FROM users WHERE id = ?", [adminId], (err, userResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const isAdmin = userResult && userResult[0]?.role === 'admin';
        const userName = userResult[0]?.fullname || 'Administrator';
        
        const proceed = () => {
            const query = `INSERT INTO tasks 
                (title, description, priority, deadline, status, created_by, assigned_by, assigned_at, progress, team_id) 
                VALUES (?, ?, ?, ?, 'pending', ?, ?, NOW(), 0, ?)`;
            
            db.query(query, [title, description, priority, deadline, created_by, assigned_by, teamId], async (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                
                db.query("SELECT name FROM teams WHERE id = ?", [teamId], (err, teamResult) => {
                    if (err) return;
                    const teamName = teamResult[0]?.name || 'Team';
                    
                    db.query("SELECT u.email, u.fullname FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = ?", 
                        [teamId], 
                        async (err, members) => {
                            if (err) return;
                            
                            for (const member of members) {
                                if (member.email) {
                                    const sendTeamTaskAssignedEmail = async (email, fullname, teamName, taskTitle, priority, deadline, adminName) => {
                                        const mailOptions = {
                                            from: `"TaskFlow Support" <${process.env.EMAIL_USER}>`,
                                            to: email,
                                            subject: `📋 New Task Assigned to ${teamName} - ${taskTitle}`,
                                            html: `<p>New task: ${taskTitle} assigned to your team</p>`
                                        };
                                        try { await transporter.sendMail(mailOptions); } catch(e) {}
                                    };
                                    await sendTeamTaskAssignedEmail(member.email, member.fullname, teamName, title, priority, deadline || 'Not specified', userName);
                                }
                            }
                        });
                });
                
                res.json({ message: "Team task created", taskId: result.insertId });
            });
        };
        
        if (!isAdmin) {
            db.query("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, adminId], (err, teamResult) => {
                if (err) return res.status(500).json({ error: err.message });
                if (teamResult.length === 0 || teamResult[0].role !== 'lead') {
                    return res.status(403).json({ error: "Unauthorized: Only admin or team lead can create team tasks" });
                }
                proceed();
            });
        } else {
            proceed();
        }
    });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: https://taskflow-pro-production-acce.up.railway.app/health`);
    console.log(`📋 Tasks endpoint: https://taskflow-pro-production-acce.up.railway.app/tasks`);
});