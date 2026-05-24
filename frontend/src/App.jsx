import { useTheme } from './context/ThemeContext';
import { FaBars, FaSun, FaMoon, FaTasks, FaCalendarAlt, FaClock, FaExclamationTriangle, FaCheckCircle, FaPlus, FaSignOutAlt, FaUserCircle, FaChartPie, FaBell, FaChevronLeft, FaChevronRight, FaUserShield, FaUsers, FaTrash, FaCrown, FaEye, FaSearch, FaEdit, FaChevronDown, FaCamera, FaIdCard, FaDownload, FaChartLine } from 'react-icons/fa';
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Login from "./Login";
import TaskComments from './components/TaskComments';
import TeamSidebar from './components/TeamSidebar';
import TeamTasksView from './components/TeamTasksView';
import "./App.css";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, isBefore, isToday, isThisWeek, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, getDaysInMonth, getDay, formatDistanceToNow } from "date-fns";


// Production API URL (change this after Railway deployment)
const API_URL = import.meta.env.VITE_API_URL || 'https://your-backend.up.railway.app';



function App() {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskDetail, setShowTaskDetail] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedViewUser, setSelectedViewUser] = useState(null);
  const [formData, setFormData] = useState({ title: "", description: "", priority: "MEDIUM", deadline: "" });
  const [updatingProgress, setUpdatingProgress] = useState(null);
  
  // Report Data State
  const [reportData, setReportData] = useState({ 
    summary: { total: 0, completed: 0, inProgress: 0, pending: 0, avgProgress: 0, completionRate: 0 }, 
    completedTasks: [] 
  });
  
  // Admin Panel States
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRoleFilter, setAdminRoleFilter] = useState('all');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [expandedUser, setExpandedUser] = useState(null);
  
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Profile Panel States
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullname: '',
    username: '',
    email: '',
    about: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Task Assignment States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserForTask, setSelectedUserForTask] = useState(null);
  const [assignTaskData, setAssignTaskData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    deadline: ''
  });

  // Notice/Announcement States
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [notices, setNotices] = useState([]);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [showNoticePanel, setShowNoticePanel] = useState(false);
  const [noticeFormData, setNoticeFormData] = useState({
    title: '',
    message: '',
    priority: 'medium',
    expires_at: '',
    sendToAll: true,
    selectedUsers: []
  });

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Team States
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamRefreshTrigger, setTeamRefreshTrigger] = useState(0);
  const [showTeamTasks, setShowTeamTasks] = useState(false);

  // Feature 3: Filter States
  const [taskFilters, setTaskFilters] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  });

  // Feature 5: Last Activity Tracking
  const [lastActivity, setLastActivity] = useState(() => {
    const saved = localStorage.getItem('lastActivity');
    return saved ? new Date(saved) : null;
  });

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const refreshTeams = () => {
    setTeamRefreshTrigger(prev => prev + 1);
  };

  // Feature 3: Clear all filters
  const clearFilters = () => {
    setTaskFilters({
      status: 'all',
      priority: 'all',
      search: ''
    });
    showNotification("Filters cleared!", "info");
  };

  // Feature 3: Get filtered tasks
  const getFilteredTasks = () => {
    let filtered = [...tasks];
    
    if (taskFilters.status !== 'all') {
      filtered = filtered.filter(t => t.status === taskFilters.status);
    }
    
    if (taskFilters.priority !== 'all') {
      filtered = filtered.filter(t => t.priority === taskFilters.priority);
    }
    
    if (taskFilters.search) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(taskFilters.search.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Feature 5: Update last activity
  const updateLastActivity = () => {
    const now = new Date();
    setLastActivity(now);
    localStorage.setItem('lastActivity', now.toISOString());
  };

  // ============ DESKTOP PUSH NOTIFICATIONS ============
  
  useEffect(() => {
    if (user && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  const showDesktopNotification = (title, body, onClickUrl = null) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/vite.svg',
        requireInteraction: true,
        silent: false
      });
      
      if (onClickUrl) {
        notification.onclick = () => {
          window.focus();
        };
      }
      
      setTimeout(() => notification.close(), 10000);
    }
  };

  // ============ FETCH NOTIFICATIONS ============
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`http://localhost:5000/notifications?userId=${user.id}`);
      setNotifications(res.data.notifications || []);
      setUnreadNotifications(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [user]);

  const markNotificationRead = async (notificationId) => {
    try {
      await axios.put(`http://localhost:5000/notifications/${notificationId}/read`, { userId: user.id });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.put(`http://localhost:5000/notifications/read-all`, { userId: user.id });
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // ============ AUTO LOGIN ============
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) setUser(storedUser);
  }, []);

  // ============ FETCH TASKS ============
  const fetchTasks = useCallback(() => {
    if (!user) return;
    const targetUserId = selectedViewUser ? selectedViewUser.id : user.id;
    const targetUserRole = selectedViewUser ? 'user' : user.role;
    
    axios.get(`http://localhost:5000/tasks?userId=${targetUserId}&userRole=${targetUserRole}`)
      .then(res => setTasks(res.data))
      .catch(() => {});
  }, [user, selectedViewUser]);

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, fetchTasks, selectedViewUser]);

  // ============ FETCH REPORT DATA ============
  const fetchReportData = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/report');
      setReportData(res.data);
    } catch (err) {
      console.error("Failed to fetch report:", err);
    }
  }, []);

  // ============ DOWNLOAD WORD REPORT ============
  const downloadWordReport = async () => {
    try {
      window.open('http://localhost:5000/download-report', '_blank');
      showNotification("Report download started!", "success");
    } catch (err) {
      showNotification("Failed to download report", "error");
    }
  };

  // ============ PROGRESS UPDATE FUNCTION ============
  const updateProgress = async (id, newProgress) => {
    try {
      setUpdatingProgress(id);
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      
      const clampedProgress = Math.min(100, Math.max(0, newProgress));
      let newStatus = task.status;
      
      if (clampedProgress === 100 && task.status !== 'completed') {
        newStatus = 'completed';
      } 
      else if (clampedProgress < 100 && task.status === 'completed') {
        newStatus = 'pending';
      }
      
      console.log(`Updating task ${id}: Progress ${task.progress || 0}% → ${clampedProgress}%, Status: ${newStatus}`);
      
      await axios.put(`http://localhost:5000/tasks/${id}/status`, { 
        status: newStatus, 
        progress: clampedProgress 
      });
      
      await fetchTasks();
      await fetchReportData();
      updateLastActivity(); // Feature 5
      
      if (clampedProgress === 100 && task.status !== 'completed') {
        showDesktopNotification(
          '🎉 Task Completed!',
          `"${task.title}" has been completed!`,
          '/tasks'
        );
        showNotification(`🎉 Task "${task.title}" completed!`, "success");
      } else {
        showNotification(`Progress updated to ${clampedProgress}%`, "info");
      }
    } catch (err) {
      console.error("Progress update error:", err);
      showNotification("Failed to update progress", "error");
    } finally {
      setUpdatingProgress(null);
    }
  };

  // ============ FETCH ALL USERS (ADMIN ONLY) ============
  const fetchAllUsers = useCallback(() => {
    if (!user || user.role !== 'admin') return;
    axios.get(`http://localhost:5000/users?adminId=${user.id}`)
      .then(res => {
        const usersWithStatus = res.data.map(u => ({
          ...u,
          status: 'active',
          joinDate: 'January 15, 2026',
          lastActive: 'Today'
        }));
        setAllUsers(usersWithStatus);
      })
      .catch(err => console.error("Failed to fetch users:", err));
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'admin') fetchAllUsers();
  }, [user, fetchAllUsers]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notification-bell')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNotifications]);

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = adminSearch === '' || 
      u.fullname?.toLowerCase().includes(adminSearch.toLowerCase()) ||
      u.unique_id?.toLowerCase().includes(adminSearch.toLowerCase());
    const matchesRole = adminRoleFilter === 'all' || u.role === adminRoleFilter;
    const matchesStatus = adminStatusFilter === 'all' || u.status === adminStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  useEffect(() => {
    if (activeView === 'report' && user && user.role === 'admin') {
      fetchReportData();
    }
  }, [activeView, user, fetchReportData]);

  // ============ NOTICE FUNCTIONS ============
  const fetchNotices = useCallback(() => {
    if (!user) return;
    axios.get(`http://localhost:5000/notices?userId=${user.id}`)
      .then(res => {
        setNotices(res.data.notices || []);
        setUnreadNotices(res.data.unreadCount || 0);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user) fetchNotices();
  }, [user, fetchNotices]);

  const markNoticeAsRead = async (noticeId) => {
    try {
      await axios.put(`http://localhost:5000/notices/${noticeId}/read`, { userId: user.id });
      fetchNotices();
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const sendNotice = async () => {
    if (!noticeFormData.title.trim()) {
      showNotification("Please enter notice title", "error");
      return;
    }
    
    if (!noticeFormData.message.trim()) {
      showNotification("Please enter notice message", "error");
      return;
    }
    
    try {
      await axios.post("http://localhost:5000/notices", {
        title: noticeFormData.title,
        message: noticeFormData.message,
        priority: noticeFormData.priority,
        expires_at: noticeFormData.expires_at,
        sendToAll: noticeFormData.sendToAll,
        recipient_users: noticeFormData.selectedUsers,
        adminId: user.id
      });
      
      showDesktopNotification(
        '📢 Announcement Sent',
        `"${noticeFormData.title}" sent to ${noticeFormData.sendToAll ? 'all users' : noticeFormData.selectedUsers.length + ' user(s)'}`,
        '/notices'
      );
      
      showNotification("Notice sent successfully!", "success");
      setShowNoticeModal(false);
      setNoticeFormData({
        title: '',
        message: '',
        priority: 'medium',
        expires_at: '',
        sendToAll: true,
        selectedUsers: []
      });
      fetchNotices();
    } catch (err) {
      showNotification("Failed to send notice", "error");
    }
  };

  const deleteNotice = async (noticeId) => {
    if (window.confirm("Delete this notice?")) {
      try {
        await axios.delete(`http://localhost:5000/notices/${noticeId}`, { data: { adminId: user.id } });
        showNotification("Notice deleted", "success");
        fetchNotices();
      } catch (err) {
        showNotification("Failed to delete notice", "error");
      }
    }
  };

  // ============ CRUD OPERATIONS ============
  const addTask = () => {
    if (!formData.title.trim()) {
        showNotification("Please enter task title", "error");
        return;
    }
    
    let targetUserId;
    let assignedById;
    let assignedByNameValue;
    
    if (selectedViewUser) {
        targetUserId = selectedViewUser.id;
        assignedById = user.id;
        assignedByNameValue = user.fullname;
    } else {
        targetUserId = user.id;
        assignedById = user.id;
        assignedByNameValue = user.fullname;
    }
    
    axios.post("http://localhost:5000/tasks", { 
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        deadline: formData.deadline,
        created_by: targetUserId,
        assigned_by: assignedById,
        assigned_by_name: assignedByNameValue,
        status: "pending" 
    })
    .then(() => {
        fetchTasks();
        fetchReportData();
        updateLastActivity(); // Feature 5
        
        if (targetUserId === user.id) {
            showDesktopNotification(
                '✅ Task Created',
                `"${formData.title}" added to your tasks`,
                '/tasks'
            );
        } else {
            showDesktopNotification(
                '📋 Task Assigned',
                `"${formData.title}" assigned to ${selectedViewUser?.fullname}`,
                '/tasks'
            );
        }
        
        setFormData({ title: "", description: "", priority: "MEDIUM", deadline: "" });
        setShowAddModal(false);
        showNotification("Task added successfully!");
    })
    .catch(() => showNotification("Failed to add task", "error"));
};

  const updateTask = () => {
    axios.put(`http://localhost:5000/tasks/${editingTask.id}`, formData)
      .then(() => {
        fetchTasks();
        fetchReportData();
        updateLastActivity(); // Feature 5
        setEditingTask(null);
        setFormData({ title: "", description: "", priority: "MEDIUM", deadline: "" });
        setShowAddModal(false);
        showNotification("Task updated successfully!");
      })
      .catch(() => showNotification("Failed to update task", "error"));
  };

  const updateStatus = async (id, status) => {
    try {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      
      let newProgress = task.progress || 0;
      
      if (status === 'completed' && task.status !== 'completed') {
        newProgress = 100;
      }
      else if (status === 'pending' && task.status === 'completed') {
        newProgress = 0;
      }
      
      await axios.put(`http://localhost:5000/tasks/${id}/status`, { 
        status: status,
        progress: newProgress
      });
      
      await fetchTasks();
      await fetchReportData();
      updateLastActivity(); // Feature 5
      
      const statusText = status === 'pending' ? 'Pending' : status === 'inprogress' ? 'In Progress' : 'Completed';
      showDesktopNotification(
        '🔄 Task Status Updated',
        `"${task.title}" marked as ${statusText}`,
        '/tasks'
      );
      
      showNotification(`Task moved to ${status}`, "success");
    } catch (err) {
      console.error("Status update error:", err);
      showNotification("Failed to update status", "error");
    }
  };

  const deleteTask = (id) => {
    if (window.confirm("Delete this task?")) {
      axios.delete(`http://localhost:5000/tasks/${id}`)
        .then(() => { 
          fetchTasks();
          fetchReportData();
          updateLastActivity(); // Feature 5
          showNotification("Task deleted"); 
        });
    }
  };

  // ============ ASSIGN TASK TO USER ============
  const openAssignTaskModal = (userToAssign) => {
    setSelectedUserForTask(userToAssign);
    setAssignTaskData({
      title: '',
      description: '',
      priority: 'MEDIUM',
      deadline: ''
    });
    setShowAssignModal(true);
  };

  const assignTaskToUser = async () => {
    if (!assignTaskData.title.trim()) {
      showNotification("Please enter task title", "error");
      return;
    }
    
    if (!assignTaskData.deadline) {
      showNotification("Please select due date", "error");
      return;
    }
    
    try {
      await axios.post("http://localhost:5000/tasks", {
        title: assignTaskData.title,
        description: assignTaskData.description,
        priority: assignTaskData.priority,
        deadline: assignTaskData.deadline,
        created_by: selectedUserForTask.id,
        assigned_by: user.id,
        status: "pending"
      });
      
      showDesktopNotification(
        '📋 Task Assigned',
        `Task "${assignTaskData.title}" assigned to ${selectedUserForTask.fullname}`,
        '/tasks'
      );
      
      showNotification(`Task assigned to ${selectedUserForTask.fullname} successfully!`, "success");
      setShowAssignModal(false);
      setAssignTaskData({ title: '', description: '', priority: 'MEDIUM', deadline: '' });
      fetchTasks();
      fetchReportData();
      updateLastActivity(); // Feature 5
    } catch (err) {
      showNotification("Failed to assign task", "error");
    }
  };

  // ============ ADMIN FUNCTIONS ============
  const makeAdmin = async (userId) => {
    try {
      const response = await axios.put(`http://localhost:5000/users/${userId}/make-admin`, { adminId: user.id });
      
      showDesktopNotification(
        '👑 User Promoted',
        `${user.fullname} promoted a user to Administrator`,
        '/admin'
      );
      
      showNotification("User promoted to admin! New ID: " + response.data.newId, "success");
      fetchAllUsers();
      fetchTasks();
      fetchReportData();
    } catch (err) {
      showNotification("Failed to promote user", "error");
    }
  };

  // ============ DELETE USER ============
  const deleteUser = async (userId) => {
    if (window.confirm(`⚠️ Delete this user? All their tasks will also be deleted.`)) {
      try {
        const response = await axios({
          method: 'DELETE',
          url: `http://localhost:5000/users/${userId}`,
          data: { adminId: user.id },
          headers: { 'Content-Type': 'application/json' }
        });
        
        showNotification(response.data.message || "User deleted successfully", "success");
        
        await fetchAllUsers();
        await fetchTasks();
        await fetchReportData();
        
        if (selectedViewUser?.id === userId) {
          setSelectedViewUser(null);
        }
        
        showDesktopNotification('🗑️ User Deleted', `User has been removed from the system`, '/admin');
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.message || "Failed to delete user";
        showNotification(errorMsg, "error");
      }
    }
  };

  const viewUserTasks = (userToView) => {
    setSelectedViewUser(userToView);
    setShowAdminPanel(false);
    setActiveView('tasks');
    showNotification(`Viewing tasks for ${userToView.fullname} (${userToView.unique_id})`, "info");
  };

  const resetToMyTasks = () => {
    setSelectedViewUser(null);
    fetchTasks();
    showNotification("Back to your tasks", "info");
  };

  const exportUserData = () => {
    const csv = allUsers.map(u => `${u.unique_id},${u.fullname},${u.email},${u.role}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    a.click();
    showNotification("Users exported successfully!", "success");
  };

  const sendBulkEmail = () => {
    showNotification("Email sent to all users!", "success");
  };

  // ============ PROFILE FUNCTIONS ============
  const loadProfileData = () => {
    if (user) {
      setEditFormData({
        fullname: user.fullname || '',
        username: user.username || '',
        email: user.email || '',
        about: user.about || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  };

  useEffect(() => {
    if (showProfilePanel) {
      loadProfileData();
    }
  }, [showProfilePanel, user]);

  const handleProfileUpdate = async () => {
    if (editFormData.newPassword && editFormData.newPassword !== editFormData.confirmPassword) {
      showNotification("Passwords don't match!", "error");
      return;
    }
    
    if (!editFormData.fullname.trim()) {
      showNotification("Full name is required", "error");
      return;
    }
    
    try {
      const updateData = {
        fullname: editFormData.fullname,
        username: editFormData.username,
        email: editFormData.email,
        about: editFormData.about || ''
      };
      
      if (editFormData.newPassword && editFormData.newPassword.trim() !== '') {
        updateData.password = editFormData.newPassword;
      }
      
      await axios.put(`http://localhost:5000/users/${user.id}`, updateData);
      
      const updatedUser = { 
        ...user, 
        fullname: editFormData.fullname,
        username: editFormData.username,
        email: editFormData.email,
        about: editFormData.about
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      showNotification("Profile updated successfully!", "success");
      setIsEditing(false);
    } catch (err) {
      showNotification("Failed to update profile", "error");
    }
  };

  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result;
        setProfilePicture(imageData);
        localStorage.setItem(`profilePic_${user.id}`, imageData);
        showNotification("Profile picture updated!", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (user) {
      const savedPic = localStorage.getItem(`profilePic_${user.id}`);
      if (savedPic) setProfilePicture(savedPic);
    }
  }, [user]);

  // ============ CALENDAR FUNCTIONS ============
  const getMonthDays = () => {
    const start = startOfMonth(currentMonth);
    const startDay = getDay(start);
    const daysInMonth = getDaysInMonth(currentMonth);
    const days = [];
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: addDays(start, -i - 1), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const getTasksForDate = (date) => {
    return tasks.filter(task => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => { setCurrentMonth(new Date()); setSelectedDate(new Date()); };

  // ============ STATISTICS ============
  const todayTasks = tasks.filter(t => t.deadline && isToday(new Date(t.deadline)));
  const weekTasks = tasks.filter(t => t.deadline && isThisWeek(new Date(t.deadline)));
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const overdueTasks = tasks.filter(t => t.status !== "completed" && t.deadline && isBefore(new Date(t.deadline), new Date()));
  const completionRate = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const urgentImportant = tasks.filter(t => t.priority === "HIGH" && t.deadline && isBefore(new Date(t.deadline), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)));
  const urgentNotImportant = tasks.filter(t => t.priority === "MEDIUM" && t.deadline && isBefore(new Date(t.deadline), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)));
  const notUrgentImportant = tasks.filter(t => t.priority === "HIGH" && (!t.deadline || !isBefore(new Date(t.deadline), new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))));
  const notUrgentNotImportant = tasks.filter(t => t.priority === "LOW");

  if (!user) return <Login setUser={setUser} />;

  return (
    <div className="app">
      <AnimatePresence>
        {notification && (
          <motion.div className={`toast ${notification.type}`} initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}>
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FaBars />
          </button>
          <div className="logo-icon">TS</div>
          <h1>TaskScheduler <span>Pro</span></h1>
        </div>
        <div className="header-right">
          <div className="notice-bell" onClick={() => setShowNoticePanel(true)} style={{ cursor: 'pointer', position: 'relative' }}>
            <FaBell />
            {unreadNotices > 0 && <span className="notice-badge">{unreadNotices}</span>}
          </div>
          
          <div className="notification-bell" onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: 'pointer', position: 'relative' }}>
            <FaBell />
            {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            
            {showNotifications && (
              <div className="notification-dropdown" onClick={e => e.stopPropagation()}>
                <div className="notification-header">
                  <h4>Notifications</h4>
                  {unreadNotifications > 0 && (
                    <button onClick={markAllNotificationsRead} className="mark-all-read">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <FaBell />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          markNotificationRead(notif.id);
                          setShowNotifications(false);
                          if (notif.type === 'mention' || notif.type === 'comment') {
                            setActiveView('tasks');
                          }
                        }}
                      >
                        <div className="notification-icon">
                          {notif.type === 'mention' && '📢'}
                          {notif.type === 'comment' && '💬'}
                          {notif.type === 'task_assigned' && '📋'}
                          {notif.type === 'task_completed' && '✅'}
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">{notif.title}</div>
                          <div className="notification-message">{notif.message}</div>
                          <div className="notification-time">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        {!notif.is_read && <div className="notification-dot"></div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {user.role === 'admin' && (
            <button className="admin-btn" onClick={() => setShowAdminPanel(true)}>
              <FaUserShield /> Admin
            </button>
          )}
          <div className="user-info" onClick={() => setShowProfilePanel(true)} style={{ cursor: 'pointer' }}>
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="user-avatar-img" />
            ) : (
              <div className="user-avatar">{user.fullname?.charAt(0)}</div>
            )}
            <div className="user-details">
              <span>{user.fullname}</span>
              <small>{user.unique_id}</small>
              {/* Feature 5: Last Active Badge */}
              {lastActivity && (
                <span className="last-active-badge">
                  • Active {formatDistanceToNow(lastActivity, { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
          <button className="logout-btn" onClick={() => { localStorage.removeItem("user"); setUser(null); setSelectedViewUser(null); }}>
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </header>

      {/* Viewing Banner */}
      {selectedViewUser && (
        <div className="viewing-banner">
          <div className="banner-content">
            <FaEye /> Viewing tasks for <strong>{selectedViewUser.fullname}</strong> ({selectedViewUser.unique_id})
          </div>
          <button className="reset-view-btn" onClick={resetToMyTasks}>Back to My Tasks</button>
        </div>
      )}

      <div className="main-layout">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-section">
            <div className="sidebar-title">MAIN</div>
            <ul className="sidebar-menu">
              <li className={activeView === 'dashboard' ? 'active' : ''} onClick={() => setActiveView('dashboard')} data-tooltip="Dashboard">
                <FaChartPie /> <span>Dashboard</span>
              </li>
              {/* Feature 1: Task Counter Badge already present */}
              <li className={activeView === 'tasks' ? 'active' : ''} onClick={() => setActiveView('tasks')} data-tooltip="My Tasks">
                <FaTasks /> <span>My Tasks</span> 
                <span className="menu-badge">{pendingTasks.length}</span>
              </li>
              <li className={activeView === 'calendar' ? 'active' : ''} onClick={() => setActiveView('calendar')} data-tooltip="Calendar">
                <FaCalendarAlt /> <span>Calendar</span>
              </li>
              <li className={activeView === 'priority' ? 'active' : ''} onClick={() => setActiveView('priority')} data-tooltip="Priority Matrix">
                <FaExclamationTriangle /> <span>Priority Matrix</span>
              </li>
              <li className={activeView === 'notices' ? 'active' : ''} onClick={() => setActiveView('notices')} data-tooltip="Notices">
                <FaBell /> <span>Notices</span>
                {unreadNotices > 0 && <span className="menu-badge notice-menu-badge">{unreadNotices}</span>}
              </li>
              {user.role === 'admin' && (
                <li className={activeView === 'report' ? 'active' : ''} onClick={() => setActiveView('report')} data-tooltip="Daily Report">
                  <FaChartLine /> <span>Daily Report</span>
                </li>
              )}
            </ul>
          </div>
          
          <TeamSidebar 
            user={user}
            onSelectTeam={(team) => {
              setSelectedTeam(team);
              setShowTeamTasks(true);
              setActiveView('team-tasks');
            }}
            selectedTeamId={selectedTeam?.id}
            refreshTrigger={teamRefreshTrigger}
            onTeamDeleted={refreshTeams}
          />
          
          <div className="sidebar-section">
            <div className="sidebar-title">QUICK LINKS</div>
            <ul className="sidebar-menu">
              <li onClick={() => setShowAddModal(true)} data-tooltip="New Task"><FaPlus /> <span>New Task</span></li>
              <li onClick={() => setShowNoticePanel(true)} data-tooltip="View Notices"><FaBell /> <span>View Notices</span></li>
              <li onClick={() => { setActiveView('dashboard'); }} data-tooltip="Today's Schedule"><FaClock /> <span>Today's Schedule</span></li>
            </ul>
          </div>
          
          {user.role === 'admin' && (
            <div className="sidebar-section">
              <div className="sidebar-title">ADMIN</div>
              <ul className="sidebar-menu">
                <li onClick={() => setShowAdminPanel(true)} data-tooltip="User Management"><FaUsers /> <span>User Management</span></li>
              </ul>
            </div>
          )}
        </aside>

        <main className="content-area">
          
          {/* ========== DASHBOARD VIEW ========== */}
          {activeView === 'dashboard' && (
            <>
              <div className="date-header">
                <div className="date-title">
                  <h2>Welcome back, {user.fullname.split(' ')[0]}</h2>
                  <p>{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
                  <p className="user-id-badge"><FaIdCard /> {user.unique_id}</p>
                  {selectedViewUser && <p className="viewing-note">👁️ Viewing: {selectedViewUser.fullname}'s data</p>}
                </div>
                <button className="today-btn" onClick={() => setActiveView('calendar')}>View Calendar →</button>
              </div>

              <div className="stats-grid">
                <div className="stat-card"><div className="stat-number">{pendingTasks.length}</div><div className="stat-label">Pending Tasks</div></div>
                <div className="stat-card"><div className="stat-number">{completedTasks.length}</div><div className="stat-label">Completed</div></div>
                <div className="stat-card"><div className="stat-number">{overdueTasks.length}</div><div className="stat-label">Overdue</div></div>
                <div className="stat-card"><div className="stat-number">{completionRate}%</div><div className="stat-label">Completion Rate</div></div>
              </div>

              <div className="schedule-card">
                <div className="card-header">
                  <div className="card-title"><FaClock /> Today's Schedule</div>
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Task</button>
                </div>
                <div className="task-list">
                  {todayTasks.length === 0 ? (
                    <div className="empty-state">No tasks scheduled for today</div>
                  ) : (
                    todayTasks
                      .filter(task => {
                        if (selectedViewUser) return true;
                        if (user.role === 'admin') {
                          return task.created_by === user.id || task.assigned_by === user.id;
                        }
                        return task.created_by === user.id;
                      })
                      .map(task => {
                        const canComplete = task.created_by === user.id;
                        const assignedByMe = task.assigned_by === user.id && task.created_by !== user.id;
                        const assignedToMe = task.created_by === user.id;
                        // Feature 6: Progress color
                        const progressColor = task.progress >= 70 ? '#10b981' : (task.progress >= 30 ? '#f59e0b' : '#ef4444');
                        
                        return (
                          <div key={task.id} className="task-item" onClick={() => setShowTaskDetail(task)} style={{ cursor: 'pointer' }}>
                            <div className="task-check">
                              {canComplete ? (
                                <input 
                                  type="checkbox" 
                                  checked={task.status === "completed"} 
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateStatus(task.id, task.status === "completed" ? "pending" : "completed");
                                  }}
                                  title="Mark as complete"
                                />
                              ) : (
                                <span className="checkbox-disabled" title="Only the assigned user can complete this task">
                                  ⚠️
                                </span>
                              )}
                            </div>
                            <div className="task-content">
                              <div className="task-title" style={{ textDecoration: task.status === "completed" ? 'line-through' : 'none' }}>
                                {task.title}
                              </div>
                              <div className="task-meta">
                                <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                                {assignedByMe && (
                                  <span className="assigned-by-me-badge">📤 Assigned by you</span>
                                )}
                                {assignedToMe && task.assigned_by_name && task.assigned_by_name !== user.fullname && (
                                  <span className="assigned-badge">👑 Assigned by: {task.assigned_by_name}</span>
                                )}
                                {!assignedToMe && !assignedByMe && task.created_by_name && (
                                  <span className="assigned-to-badge">👤 Assigned to: {task.created_by_name}</span>
                                )}
                              </div>
                              {!canComplete && task.status !== "completed" && (
                                <div className="cannot-complete-warning">
                                  ⚡ Only {task.created_by_name || 'the assignee'} can complete this task
                                </div>
                              )}
                              {/* Feature 4: Task Preview on Hover */}
                              {task.description && (
                                <div className="task-preview">
                                  <strong>Description:</strong> {task.description.substring(0, 100)}
                                  {task.description.length > 100 && '...'}
                                </div>
                              )}
                            </div>
                            <div className="task-time">
                              {task.deadline ? format(new Date(task.deadline), 'h:mm a') : 'All day'}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="schedule-card">
                <div className="card-header"><div className="card-title"><FaExclamationTriangle /> Upcoming Deadlines (This Week)</div></div>
                <div className="deadline-list">
                  {weekTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="deadline-item" onClick={() => setShowTaskDetail(task)} style={{ cursor: 'pointer' }}>
                      <div className="deadline-date">{format(new Date(task.deadline), 'MMM dd')}</div>
                      <div className="deadline-title">{task.title}</div>
                      {isBefore(new Date(task.deadline), new Date()) && <div className="deadline-warning">OVERDUE</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ========== TASKS VIEW WITH FILTERS ========== */}
          {activeView === 'tasks' && (
            <div className="schedule-card">
              <div className="card-header">
                <div className="card-title"><FaTasks /> {selectedViewUser ? `Tasks: ${selectedViewUser.fullname}` : 'Task Management'}</div>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ New Task</button>
              </div>
              
              {/* Feature 3: Filter UI */}
              <div className="task-filters">
                <div className="filter-group">
                  <label>Status:</label>
                  <select value={taskFilters.status} onChange={(e) => setTaskFilters({...taskFilters, status: e.target.value})}>
                    <option value="all">All</option>
                    <option value="pending">⏳ Pending</option>
                    <option value="inprogress">🔄 In Progress</option>
                    <option value="completed">✅ Completed</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label>Priority:</label>
                  <select value={taskFilters.priority} onChange={(e) => setTaskFilters({...taskFilters, priority: e.target.value})}>
                    <option value="all">All</option>
                    <option value="HIGH">🔴 High</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="LOW">🟢 Low</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <input
                    type="text"
                    placeholder="🔍 Search tasks..."
                    value={taskFilters.search}
                    onChange={(e) => setTaskFilters({...taskFilters, search: e.target.value})}
                    className="filter-search"
                  />
                </div>
                
                <button className="clear-filters-btn" onClick={clearFilters}>
                  🧹 Clear Filters
                </button>
              </div>
              
              <div className="task-section">
                <h3 className="section-title">📋 My Tasks</h3>
                {getFilteredTasks().filter(t => t.created_by === (selectedViewUser ? selectedViewUser.id : user.id)).length === 0 ? (
                  <div className="empty-state">No tasks found</div>
                ) : (
                  getFilteredTasks().filter(t => t.created_by === (selectedViewUser ? selectedViewUser.id : user.id)).map(task => {
                    // Feature 6: Progress color
                    const progressColor = task.progress >= 70 ? '#10b981' : (task.progress >= 30 ? '#f59e0b' : '#ef4444');
                    
                    return (
                      <div key={task.id} className="task-item" onClick={() => setShowTaskDetail(task)} style={{ cursor: 'pointer' }}>
                        <div className="task-check">
                          <input type="checkbox" checked={task.status === "completed"} onChange={(e) => {
                            e.stopPropagation();
                            updateStatus(task.id, task.status === "completed" ? "pending" : "completed");
                          }} />
                        </div>
                        <div className="task-content">
                          <div className="task-title" style={{ textDecoration: task.status === "completed" ? 'line-through' : 'none' }}>{task.title}</div>
                          <div className="task-meta">
                            <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                            {task.deadline && <span>📅 {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>}
                            {task.assigned_by_name && task.assigned_by_name !== (selectedViewUser ? selectedViewUser.fullname : user.fullname) && (
                              <span className="assigned-badge">📌 Assigned by: {task.assigned_by_name}</span>
                            )}
                          </div>
                          <div className="progress-container">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${task.progress || 0}%`, background: progressColor }}></div>
                            </div>
                            <div className="progress-controls">
                              <button className="progress-btn" onClick={(e) => { e.stopPropagation(); updateProgress(task.id, Math.max(0, (task.progress || 0) - 10)); }} disabled={updatingProgress === task.id}>-10%</button>
                              <span className="progress-text" style={{ color: progressColor, fontWeight: 'bold' }}>{task.progress || 0}%</span>
                              <button className="progress-btn" onClick={(e) => { e.stopPropagation(); updateProgress(task.id, Math.min(100, (task.progress || 0) + 10)); }} disabled={updatingProgress === task.id}>+10%</button>
                              <button className="complete-btn" onClick={(e) => { e.stopPropagation(); updateProgress(task.id, 100); }} disabled={updatingProgress === task.id}>Complete</button>
                            </div>
                          </div>
                          {task.status === 'completed' && (
                            <div className="completed-badge">✅ Completed on {task.completed_at ? format(new Date(task.completed_at), 'MMM dd, yyyy') : 'Recently'}</div>
                          )}
                          {/* Feature 4: Task Preview on Hover */}
                          {task.description && (
                            <div className="task-preview">
                              <strong>Description:</strong> {task.description.substring(0, 100)}
                              {task.description.length > 100 && '...'}
                            </div>
                          )}
                        </div>
                        <div className="task-actions">
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingTask(task); setFormData({ title: task.title, description: task.description || "", priority: task.priority, deadline: task.deadline || "" }); setShowAddModal(true); }}>✏️</button>
                          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}>🗑️</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              {user.role === 'admin' && !selectedViewUser && (
                <div className="task-section">
                  <h3 className="section-title">👑 Tasks I Assigned to Others</h3>
                  {getFilteredTasks().filter(t => t.assigned_by === user.id && t.created_by !== user.id).length === 0 ? (
                    <div className="empty-state">No tasks assigned to others yet</div>
                  ) : (
                    getFilteredTasks().filter(t => t.assigned_by === user.id && t.created_by !== user.id).map(task => {
                      const assignedUser = allUsers.find(u => u.id === task.created_by);
                      // Feature 6: Progress color
                      const progressColor = task.progress >= 70 ? '#2e7d32' : (task.progress >= 30 ? '#ed6c02' : '#d32f2f');
                      
                      return (
                        <div key={task.id} className="task-item assigned-task" onClick={() => setShowTaskDetail(task)} style={{ cursor: 'pointer' }}>
                          <div className="task-content">
                            <div className="task-title">{task.title}</div>
                            <div className="task-meta">
                              <span className={`task-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                              {task.deadline && <span>📅 {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>}
                              <span className="assigned-to">👤 Assigned to: {assignedUser?.fullname || 'Unknown'} ({assignedUser?.unique_id})</span>
                            </div>
                            <div className="progress-container">
                              <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${task.progress || 0}%`, background: progressColor }}></div>
                              </div>
                              <div className="progress-text-assigned">
                                <span className="progress-percent">{task.progress || 0}%</span>
                                <span className="status-badge-assigned">
                                  {task.status === 'completed' ? '✅ Completed' : task.status === 'inprogress' ? '🔄 In Progress' : '⏳ Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="task-actions">
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingTask(task); setFormData({ title: task.title, description: task.description || "", priority: task.priority, deadline: task.deadline || "" }); setShowAddModal(true); }}>✏️</button>
                            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}>🗑️</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========== CALENDAR VIEW ========== */}
          {activeView === 'calendar' && (
            <div className="calendar-container">
              <div className="calendar-header">
                <div className="calendar-nav">
                  <button className="calendar-nav-btn" onClick={previousMonth}><FaChevronLeft /></button>
                  <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
                  <button className="calendar-nav-btn" onClick={nextMonth}><FaChevronRight /></button>
                </div>
                <button className="today-btn" onClick={goToToday}>Today</button>
              </div>
              <div className="calendar-weekdays">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="weekday">{day}</div>)}
              </div>
              <div className="calendar-days">
                {getMonthDays().map((day, idx) => {
                  const dayTasks = getTasksForDate(day.date);
                  const isCurrentDay = isToday(day.date);
                  return (
                    <div key={idx} className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isCurrentDay ? 'today' : ''}`}>
                      <div className="day-number">{format(day.date, 'd')}</div>
                      <div className="day-tasks">
                        {dayTasks.slice(0, 3).map(task => (
                          <div key={task.id} className={`day-task priority-${task.priority.toLowerCase()}`} onClick={() => setShowTaskDetail(task)}>
                            {task.title.length > 18 ? task.title.substring(0, 18) + '...' : task.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 && <div className="day-task-more">+{dayTasks.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========== PRIORITY MATRIX VIEW ========== */}
          {activeView === 'priority' && (
            <div className="matrix-grid">
              <div className="matrix-quadrant urgent-important"><div className="matrix-title">🔥 Urgent & Important</div>{urgentImportant.map(t => <div key={t.id} className="matrix-task" onClick={() => setShowTaskDetail(t)}>• {t.title}</div>)}</div>
              <div className="matrix-quadrant urgent-not"><div className="matrix-title">⚡ Urgent, Not Important</div>{urgentNotImportant.map(t => <div key={t.id} className="matrix-task" onClick={() => setShowTaskDetail(t)}>• {t.title}</div>)}</div>
              <div className="matrix-quadrant not-urgent-important"><div className="matrix-title">📌 Not Urgent, Important</div>{notUrgentImportant.map(t => <div key={t.id} className="matrix-task" onClick={() => setShowTaskDetail(t)}>• {t.title}</div>)}</div>
              <div className="matrix-quadrant not-urgent-not"><div className="matrix-title">🗑️ Not Urgent, Not Important</div>{notUrgentNotImportant.map(t => <div key={t.id} className="matrix-task" onClick={() => setShowTaskDetail(t)}>• {t.title}</div>)}</div>
            </div>
          )}

          {/* ========== NOTICES VIEW ========== */}
          {activeView === 'notices' && (
            <div className="notices-container">
              <div className="notices-header">
                <h2><FaBell /> Announcements & Notices</h2>
                {user.role === 'admin' && (
                  <button className="btn-primary" onClick={() => { setShowNoticeModal(true); setShowNoticePanel(false); }}>
                    <FaPlus /> New Announcement
                  </button>
                )}
              </div>
              <div className="notices-list-full">
                {notices.length === 0 ? <div className="empty-state">No notices yet</div> :
                  notices.map(notice => (
                    <div key={notice.id} className={`notice-card-full ${notice.priority_level} ${!notice.is_read ? 'unread' : ''}`} onClick={() => !notice.is_read && markNoticeAsRead(notice.id)}>
                      <div className="notice-header-full">
                        <div className="notice-title-full">
                          <span className={`priority-dot ${notice.priority_level}`}></span>
                          <strong>{notice.title}</strong>
                        </div>
                        <div className="notice-date">{format(new Date(notice.created_at), 'MMM dd, yyyy h:mm a')}</div>
                      </div>
                      <div className="notice-message-full">{notice.message}</div>
                      <div className="notice-footer-full">
                        <span className={`priority-badge-notice priority-${notice.priority_level}`}>
                          {notice.priority_level === 'high' ? '🔴 High Priority' : notice.priority_level === 'medium' ? '🟡 Medium' : '🟢 Low'}
                        </span>
                        {!notice.is_read && <span className="unread-badge">New</span>}
                        {user.role === 'admin' && <button className="delete-notice" onClick={(e) => { e.stopPropagation(); deleteNotice(notice.id); }}>🗑️ Delete</button>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ========== DAILY REPORT VIEW ========== */}
          {activeView === 'report' && user.role === 'admin' && (
            <div className="report-container">
              <div className="report-header">
                <h2><FaChartLine /> Daily Task Report</h2>
                <div className="report-actions">
                  <button className="btn-primary" onClick={downloadWordReport}>
                    <FaDownload /> Download Word Report
                  </button>
                </div>
              </div>
              
              <div className="report-content">
                <div className="report-date">
                  <h3>{format(new Date(), 'EEEE, MMMM dd, yyyy')}</h3>
                </div>
                
                <div className="stats-summary">
                  <div className="stat-box"><div className="stat-value">{reportData?.summary?.total || 0}</div><div className="stat-name">Total Tasks</div></div>
                  <div className="stat-box"><div className="stat-value">{reportData?.summary?.completed || 0}</div><div className="stat-name">Completed Today</div></div>
                  <div className="stat-box"><div className="stat-value">{reportData?.summary?.completionRate || 0}%</div><div className="stat-name">Completion Rate</div></div>
                  <div className="stat-box"><div className="stat-value">{reportData?.summary?.avgProgress || 0}%</div><div className="stat-name">Avg Progress</div></div>
                </div>
                
                <div className="report-progress">
                  <div className="progress-label">Overall Progress</div>
                  <div className="progress-bar-big">
                    <div className="progress-fill-big" style={{ width: `${reportData?.summary?.completionRate || 0}%` }}></div>
                  </div>
                  <div className="progress-percent">{reportData?.summary?.completionRate || 0}%</div>
                </div>
                
                <div className="user-tasks-section">
                  <h3>📊 User-wise Task Progress</h3>
                  <div className="user-tasks-grid">
                    {allUsers.filter(u => u.role === 'user' || u.id === user.id).map(userObj => {
                      const userTasks = tasks.filter(t => t.created_by === userObj.id);
                      const userCompleted = userTasks.filter(t => t.status === 'completed').length;
                      const userProgress = userTasks.length ? Math.round((userCompleted / userTasks.length) * 100) : 0;
                      
                      if (userTasks.length === 0) return null;
                      
                      return (
                        <div key={userObj.id} className="user-progress-card">
                          <div className="user-progress-header">
                            <div className="user-avatar-report">{userObj.fullname?.charAt(0)}</div>
                            <div className="user-info-report">
                              <h4>{userObj.fullname}</h4>
                              <span className="user-id-report">{userObj.unique_id}</span>
                            </div>
                            <div className="user-stats-report">
                              <span className="task-count">{userTasks.length} tasks</span>
                              <span className="progress-badge-report" style={{ background: userProgress > 70 ? '#2e7d32' : userProgress > 40 ? '#ed6c02' : '#d32f2f' }}>{userProgress}%</span>
                            </div>
                          </div>
                          <div className="user-progress-bar">
                            <div className="user-progress-fill" style={{ width: `${userProgress}%` }}></div>
                          </div>
                          <div className="user-tasks-list">
                            {userTasks.map(task => (
                              <div key={task.id} className="user-task-item">
                                <div className="task-status-icon">
                                  {task.status === 'completed' ? '✅' : task.status === 'inprogress' ? '🔄' : '⏳'}
                                </div>
                                <div className="task-details-report">
                                  <div className="task-title-report">{task.title}</div>
                                  <div className="task-meta-report">
                                    <span className={`priority-${task.priority?.toLowerCase() || 'medium'}`}>{task.priority || 'MEDIUM'}</span>
                                    {task.deadline && <span>📅 {format(new Date(task.deadline), 'MMM dd')}</span>}
                                    {task.assigned_by_name && task.assigned_by_name !== userObj.fullname && (
                                      <span>👤 Assigned by: {task.assigned_by_name}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="task-progress-report">
                                  <div className="small-progress-bar">
                                    <div className="small-progress-fill" style={{ width: `${task.progress || 0}%` }}></div>
                                  </div>
                                  <span className="task-progress-percent">{task.progress || 0}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="completed-tasks">
                  <h3>✅ Tasks Completed Today ({reportData?.completedTasks?.length || 0})</h3>
                  {reportData?.completedTasks?.length === 0 ? (
                    <div className="empty-state">No tasks completed today.</div>
                  ) : (
                    <table className="report-table">
                      <thead><tr><th>User</th><th>Task</th><th>Assigned By</th><th>Completed At</th></tr></thead>
                      <tbody>
                        {reportData?.completedTasks?.map(task => (
                          <tr key={task.id}>
                            <td><strong>{task.fullname}</strong><br/><small>{task.unique_id}</small></td>
                            <td>{task.title}</td>
                            <td>{task.assigned_by_name || 'Self'}</td>
                            <td>{format(new Date(task.completed_at), 'hh:mm a')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========== TEAM TASKS VIEW ========== */}
          {activeView === 'team-tasks' && selectedTeam && (
            <TeamTasksView 
              team={selectedTeam}
              user={user}
              onTaskClick={(task) => setShowTaskDetail(task)}
              onRefresh={refreshTeams}
              onTeamDeleted={() => {
                setSelectedTeam(null);
                setShowTeamTasks(false);
                setActiveView('dashboard');
                refreshTeams();
              }}
            />
          )}
        </main>
      </div>

      {/* ========== ALL MODALS ========== */}
      
      {/* Notice Panel Modal */}
      {showNoticePanel && (
        <div className="modal-overlay" onClick={() => setShowNoticePanel(false)}>
          <div className="modal notice-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaBell /> Announcements & Notices</h2>
              <button className="close-btn" onClick={() => setShowNoticePanel(false)}>✕</button>
            </div>
            {user.role === 'admin' && (
              <button className="new-notice-btn" onClick={() => { setShowNoticeModal(true); setShowNoticePanel(false); }}>
                <FaPlus /> New Announcement
              </button>
            )}
            <div className="notices-list">
              {notices.length === 0 ? <div className="empty-state">No notices yet</div> : notices.map(notice => (
                <div key={notice.id} className={`notice-card ${notice.priority_level} ${!notice.is_read ? 'unread' : ''}`} onClick={() => !notice.is_read && markNoticeAsRead(notice.id)}>
                  <div className="notice-header">
                    <div className="notice-title"><span className={`priority-dot ${notice.priority_level}`}></span><strong>{notice.title}</strong></div>
                    <div className="notice-date">{format(new Date(notice.created_at), 'MMM dd, yyyy')}</div>
                  </div>
                  <div className="notice-message">{notice.message}</div>
                  <div className="notice-footer">
                    <span className={`priority-badge-notice priority-${notice.priority_level}`}>{notice.priority_level === 'high' ? '🔴 High Priority' : notice.priority_level === 'medium' ? '🟡 Medium' : '🟢 Low'}</span>
                    {!notice.is_read && <span className="unread-badge">New</span>}
                    {user.role === 'admin' && <button className="delete-notice" onClick={(e) => { e.stopPropagation(); deleteNotice(notice.id); }}>🗑️</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Notice Modal */}
      {showNoticeModal && user.role === 'admin' && (
        <div className="modal-overlay" onClick={() => setShowNoticeModal(false)}>
          <div className="modal notice-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaPlus /> Create New Announcement</h2>
              <button className="close-btn" onClick={() => setShowNoticeModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>Title *</label><input type="text" placeholder="Enter notice title..." value={noticeFormData.title} onChange={(e) => setNoticeFormData({...noticeFormData, title: e.target.value})} /></div>
              <div className="form-group"><label>Message *</label><textarea rows="4" placeholder="Enter notice message..." value={noticeFormData.message} onChange={(e) => setNoticeFormData({...noticeFormData, message: e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label>Priority</label><select value={noticeFormData.priority} onChange={(e) => setNoticeFormData({...noticeFormData, priority: e.target.value})}><option value="low">🟢 Low Priority</option><option value="medium">🟡 Medium Priority</option><option value="high">🔴 High Priority</option></select></div>
                <div className="form-group"><label>Expires On (Optional)</label><input type="date" value={noticeFormData.expires_at} onChange={(e) => setNoticeFormData({...noticeFormData, expires_at: e.target.value})} /></div>
              </div>
              <div className="form-group">
                <label>Send To</label>
                <div className="radio-group">
                  <label className="radio-label"><input type="radio" checked={noticeFormData.sendToAll} onChange={() => setNoticeFormData({...noticeFormData, sendToAll: true, selectedUsers: []})} /> All Users</label>
                  <label className="radio-label"><input type="radio" checked={!noticeFormData.sendToAll} onChange={() => setNoticeFormData({...noticeFormData, sendToAll: false})} /> Specific Users</label>
                </div>
              </div>
              {!noticeFormData.sendToAll && (
                <div className="form-group">
                  <label>Select Users</label>
                  {allUsers.filter(u => u.role === 'admin' && u.id !== user.id).length > 0 && (
                    <div className="user-category">
                      <div className="category-header"><span className="category-title">👑 Administrators</span><button type="button" className="select-all-btn" onClick={() => { const adminIds = allUsers.filter(u => u.role === 'admin' && u.id !== user.id).map(u => u.id); setNoticeFormData({...noticeFormData, selectedUsers: [...noticeFormData.selectedUsers, ...adminIds]}); }}>Select All Admins</button></div>
                      <div className="user-select-list">{allUsers.filter(u => u.role === 'admin' && u.id !== user.id).map(u => (<label key={u.id} className="user-checkbox"><input type="checkbox" checked={noticeFormData.selectedUsers.includes(u.id)} onChange={(e) => { if (e.target.checked) { setNoticeFormData({...noticeFormData, selectedUsers: [...noticeFormData.selectedUsers, u.id]}); } else { setNoticeFormData({...noticeFormData, selectedUsers: noticeFormData.selectedUsers.filter(id => id !== u.id)}); } }} /><span className="admin-user">{u.fullname}</span><small>{u.unique_id} • {u.email}</small></label>))}</div>
                    </div>
                  )}
                  {allUsers.filter(u => u.role === 'user').length > 0 && (
                    <div className="user-category">
                      <div className="category-header"><span className="category-title">👤 Regular Users</span><button type="button" className="select-all-btn" onClick={() => { const userIds = allUsers.filter(u => u.role === 'user').map(u => u.id); setNoticeFormData({...noticeFormData, selectedUsers: [...noticeFormData.selectedUsers, ...userIds]}); }}>Select All Users</button></div>
                      <div className="user-select-list">{allUsers.filter(u => u.role === 'user').map(u => (<label key={u.id} className="user-checkbox"><input type="checkbox" checked={noticeFormData.selectedUsers.includes(u.id)} onChange={(e) => { if (e.target.checked) { setNoticeFormData({...noticeFormData, selectedUsers: [...noticeFormData.selectedUsers, u.id]}); } else { setNoticeFormData({...noticeFormData, selectedUsers: noticeFormData.selectedUsers.filter(id => id !== u.id)}); } }} /><span>{u.fullname}</span><small>{u.unique_id} • {u.email}</small></label>))}</div>
                    </div>
                  )}
                  <div className="selected-count">Selected: <strong>{noticeFormData.selectedUsers.length}</strong> user(s)</div>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowNoticeModal(false)}>Cancel</button><button className="btn-primary" onClick={sendNotice}><FaPlus /> Send Announcement</button></div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="modal-overlay" onClick={() => setShowAdminPanel(false)}>
          <div className="modal admin-panel-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><FaUserShield /> Admin Panel - User Management</h2><button className="close-btn" onClick={() => setShowAdminPanel(false)}>✕</button></div>
            <div className="admin-stats"><div className="admin-stat-card"><div className="admin-stat-number">{allUsers.length}</div><div className="admin-stat-label">Total Users</div></div><div className="admin-stat-card"><div className="admin-stat-number">{allUsers.filter(u => u.role === 'admin').length}</div><div className="admin-stat-label">Administrators</div></div><div className="admin-stat-card"><div className="admin-stat-number">{tasks.length}</div><div className="admin-stat-label">Total Tasks</div></div><div className="admin-stat-card"><div className="admin-stat-number">{completionRate}%</div><div className="admin-stat-label">Completion Rate</div></div></div>
            <div className="admin-filters"><div className="search-input"><FaSearch /><input type="text" placeholder="Search by ID or name..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /></div><select className="filter-select" value={adminRoleFilter} onChange={(e) => setAdminRoleFilter(e.target.value)}><option value="all">All Roles</option><option value="admin">Administrators</option><option value="user">Regular Users</option></select></div>
            <div className="users-list">{filteredUsers.map(u => { const userTasks = tasks.filter(t => t.created_by === u.id); const userCompleted = userTasks.filter(t => t.status === 'completed').length; const userPercent = userTasks.length ? Math.round((userCompleted / userTasks.length) * 100) : 0; return (<div key={u.id} className="user-card"><div className="user-info"><div className="user-avatar-small">{u.fullname?.charAt(0).toUpperCase()}</div><div><div className="user-name">{u.fullname}</div><div className="user-id">{u.unique_id}</div></div></div><div className="user-stats"><span className="stat-badge" title="Tasks assigned to them">📋 {userTasks.length} tasks</span><span className="stat-badge" title="Tasks they assigned to others">📤 {tasks.filter(t => t.assigned_by === u.id && t.assigned_by !== t.created_by).length} assigned</span><span className={`progress-badge ${userPercent > 70 ? 'high' : userPercent > 40 ? 'medium' : 'low'}`}>{userPercent}%</span></div><div className="user-actions"><button className="action-btn assign" onClick={() => openAssignTaskModal(u)} title="Assign Task"><FaPlus /></button><button className="action-btn view" onClick={() => viewUserTasks(u)} title="View Tasks"><FaEye /></button>{u.role !== 'admin' && <button className="action-btn promote" onClick={() => makeAdmin(u.id)} title="Make Admin"><FaCrown /></button>}{u.id !== user.id && <button className="action-btn delete" onClick={() => deleteUser(u.id)} title="Delete User"><FaTrash /></button>}</div></div>); })}</div>
            <div className="admin-footer"><button className="footer-btn" onClick={exportUserData}>📎 Export CSV</button><button className="footer-btn" onClick={sendBulkEmail}>✉️ Email All</button><button className="close-footer" onClick={() => setShowAdminPanel(false)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {showAssignModal && selectedUserForTask && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal assign-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><FaPlus /> Assign Task to {selectedUserForTask.fullname}</h2><button className="close-btn" onClick={() => setShowAssignModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="assign-user-info"><div className="user-avatar-small">{selectedUserForTask.fullname?.charAt(0)}</div><div><strong>{selectedUserForTask.fullname}</strong><small>{selectedUserForTask.unique_id}</small></div></div>
              <div className="form-group"><label>Task Title *</label><input type="text" placeholder="Enter task title..." value={assignTaskData.title} onChange={(e) => setAssignTaskData({...assignTaskData, title: e.target.value})} autoFocus /></div>
              <div className="form-group"><label>Description</label><textarea placeholder="Enter task description (optional)..." rows="3" value={assignTaskData.description} onChange={(e) => setAssignTaskData({...assignTaskData, description: e.target.value})} /></div>
              <div className="form-row"><div className="form-group"><label>Priority *</label><select value={assignTaskData.priority} onChange={(e) => setAssignTaskData({...assignTaskData, priority: e.target.value})}><option value="HIGH">🔴 High Priority</option><option value="MEDIUM">🟡 Medium Priority</option><option value="LOW">🟢 Low Priority</option></select></div><div className="form-group"><label>Due Date *</label><input type="datetime-local" value={assignTaskData.deadline} onChange={(e) => setAssignTaskData({...assignTaskData, deadline: e.target.value})} /></div></div>
            </div>
            <div className="modal-footer"><button className="btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button><button className="btn-primary" onClick={assignTaskToUser}><FaPlus /> Assign Task</button></div>
          </div>
        </div>
      )}

      {/* Profile Panel Modal */}
      {showProfilePanel && (
        <div className="modal-overlay" onClick={() => { setShowProfilePanel(false); setIsEditing(false); }}>
          <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2><FaUserCircle /> My Profile</h2><button className="close-btn" onClick={() => { setShowProfilePanel(false); setIsEditing(false); }}>✕</button></div>
            <div className="profile-content">
              <div className="profile-picture-section"><div className="profile-picture-container">{profilePicture ? <img src={profilePicture} alt="Profile" className="profile-picture" /> : <div className="profile-picture-placeholder">{user?.fullname?.charAt(0)}</div>}<label className="upload-btn"><FaCamera /><input type="file" accept="image/*" onChange={handleProfilePictureUpload} hidden /></label></div><p className="upload-hint">Click camera to upload photo</p></div>
              {!isEditing ? (
                <div className="profile-info-view">
                  <div className="info-row"><label>UNIQUE ID</label><p><strong className="unique-id-value">{user?.unique_id || 'Not assigned'}</strong></p></div>
                  <div className="info-row"><label>FULL NAME</label><p><strong>{user?.fullname}</strong></p></div>
                  <div className="info-row"><label>USERNAME</label><p>@{user?.username}</p></div>
                  <div className="info-row"><label>EMAIL ADDRESS</label><p>{user?.email}</p></div>
                  <div className="info-row"><label>ROLE</label><p><span className={`role-badge ${user?.role === 'admin' ? 'admin-role' : 'user-role'}`}>{user?.role === 'admin' ? '👑 Administrator' : '👤 Team Member'}</span></p></div>
                  <div className="info-row"><label>ABOUT ME</label><p>{user?.about || 'No description added yet'}</p></div>
                  <div className="info-row"><label>MEMBER SINCE</label><p>January 15, 2026</p></div>
                  <div className="info-row"><label>TOTAL TASKS</label><p>{tasks.length} tasks ({completedTasks.length} completed)</p></div>
                  <div className="info-row"><label>COMPLETION RATE</label><p>{completionRate}%</p></div>
                  {/* Feature 5: Last Active Time in Profile */}
                  <div className="info-row"><label>LAST ACTIVE</label><p>{lastActivity ? formatDistanceToNow(lastActivity, { addSuffix: true }) : 'Not available'}</p></div>
                  <button className="btn-primary edit-profile-btn" onClick={() => setIsEditing(true)}><FaEdit /> Edit Profile</button>
                </div>
              ) : (
                <div className="profile-info-edit">
                  <div className="info-row"><label>Full Name</label><input type="text" value={editFormData.fullname} onChange={(e) => setEditFormData({...editFormData, fullname: e.target.value})} /></div>
                  <div className="info-row"><label>Username</label><input type="text" value={editFormData.username} onChange={(e) => setEditFormData({...editFormData, username: e.target.value})} /></div>
                  <div className="info-row"><label>Email Address</label><input type="email" value={editFormData.email} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} /></div>
                  <div className="info-row"><label>About Me</label><textarea value={editFormData.about} onChange={(e) => setEditFormData({...editFormData, about: e.target.value})} rows="3" placeholder="Tell us about yourself..." /></div>
                  <div className="divider">Change Password (Optional)</div>
                  <div className="info-row"><label>Current Password</label><input type="password" placeholder="Enter current password" value={editFormData.currentPassword} onChange={(e) => setEditFormData({...editFormData, currentPassword: e.target.value})} /></div>
                  <div className="info-row"><label>New Password</label><input type="password" placeholder="Enter new password" value={editFormData.newPassword} onChange={(e) => setEditFormData({...editFormData, newPassword: e.target.value})} /></div>
                  <div className="info-row"><label>Confirm New Password</label><input type="password" placeholder="Confirm new password" value={editFormData.confirmPassword} onChange={(e) => setEditFormData({...editFormData, confirmPassword: e.target.value})} /></div>
                  <div className="edit-actions"><button className="btn-secondary" onClick={() => { setIsEditing(false); loadProfileData(); }}>Cancel</button><button className="btn-primary" onClick={handleProfileUpdate}>Save Changes</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal with Comments */}
      {showTaskDetail && (
        <div className="modal-overlay" onClick={() => setShowTaskDetail(null)}>
          <div className="modal task-detail-modal task-detail-with-comments" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{showTaskDetail.title}</h2>
              <button className="close-btn" onClick={() => setShowTaskDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="task-detail-info">
                <div className="detail-row"><strong>Priority:</strong><span className={`task-priority priority-${showTaskDetail.priority?.toLowerCase()}`}>{showTaskDetail.priority}</span></div>
                <div className="detail-row"><strong>Status:</strong><span className={`status-badge status-${showTaskDetail.status}`}>{showTaskDetail.status === 'completed' ? '✅ Completed' : showTaskDetail.status === 'inprogress' ? '🔄 In Progress' : '⏳ Pending'}</span></div>
                <div className="detail-row"><strong>Due Date:</strong><span>{showTaskDetail.deadline ? format(new Date(showTaskDetail.deadline), 'MMMM dd, yyyy h:mm a') : 'No date'}</span></div>
                <div className="detail-row"><strong>Progress:</strong><div className="detail-progress"><div className="progress-bar-small"><div className="progress-fill-small" style={{ width: `${showTaskDetail.progress || 0}%` }}></div></div><span>{showTaskDetail.progress || 0}%</span></div></div>
                <div className="detail-row"><strong>Description:</strong><p>{showTaskDetail.description || 'No description'}</p></div>
                {showTaskDetail.assigned_by_name && showTaskDetail.assigned_by_name !== user?.fullname && (<div className="detail-row"><strong>Assigned By:</strong><span>{showTaskDetail.assigned_by_name}</span></div>)}
              </div>
              <TaskComments taskId={showTaskDetail.id} taskTitle={showTaskDetail.title} currentUser={user} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { updateStatus(showTaskDetail.id, showTaskDetail.status === "completed" ? "pending" : "completed"); setShowTaskDetail(null); }}>{showTaskDetail.status === "completed" ? "Reopen" : "Complete"}</button>
              <button className="btn-primary" onClick={() => { setEditingTask(showTaskDetail); setFormData({ title: showTaskDetail.title, description: showTaskDetail.description || "", priority: showTaskDetail.priority, deadline: showTaskDetail.deadline || "" }); setShowAddModal(true); setShowTaskDetail(null); }}>Edit Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal with Enter Key Support */}
      {(showAddModal || editingTask) && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditingTask(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingTask ? "Edit Task" : "Create New Task"}</h2>
            {/* Feature 2: Enter Key Submit */}
            <input 
              type="text" 
              placeholder="Task title *" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && formData.title.trim()) {
                  editingTask ? updateTask() : addTask();
                }
              }}
            />
            <textarea 
              placeholder="Description" 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              rows="3" 
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && formData.title.trim()) {
                  editingTask ? updateTask() : addTask();
                }
              }}
            />
            <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
              <option value="HIGH">🔴 High Priority</option>
              <option value="MEDIUM">🟡 Medium Priority</option>
              <option value="LOW">🟢 Low Priority</option>
            </select>
            <input 
              type="datetime-local" 
              value={formData.deadline} 
              onChange={e => setFormData({...formData, deadline: e.target.value})}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && formData.title.trim()) {
                  editingTask ? updateTask() : addTask();
                }
              }}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowAddModal(false); setEditingTask(null); }}>Cancel</button>
              <button className="btn-primary" onClick={editingTask ? updateTask : addTask}>{editingTask ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme}>{isDark ? <FaSun /> : <FaMoon />}</button>
    </div>
  );
}

export default App;