import { useState, useEffect } from "react";
import axios from "axios";
import { FaUsers, FaUserCog, FaTrash, FaEye, FaTasks } from "react-icons/fa";
import "./AdminPanel.css";

export const AdminPanel = ({ currentUser, onClose, onSelectUser }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('users'); // 'users' or 'tasks'

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/users?adminId=${currentUser.id}`);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      alert("Failed to fetch users");
    }
    setLoading(false);
  };

  // Fetch tasks for selected user
  const fetchUserTasks = async (userId) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/tasks?userId=${userId}&userRole=user`);
      setUserTasks(res.data);
    } catch (err) {
      console.error("Error fetching user tasks:", err);
      alert("Failed to fetch user tasks");
    }
    setLoading(false);
  };

  // Promote user to admin
  const promoteToAdmin = async (userId) => {
    try {
      await axios.put(`http://localhost:5000/users/${userId}/make-admin`, {
        adminId: currentUser.id
      });
      alert("User promoted to admin successfully!");
      fetchUsers(); // Refresh user list
    } catch (err) {
      alert("Failed to promote user");
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user? All their tasks will also be deleted.")) {
      try {
        await axios.delete(`http://localhost:5000/users/${userId}`, {
          data: { adminId: currentUser.id }
        });
        alert("User deleted successfully!");
        fetchUsers(); // Refresh user list
        if (selectedUser?.id === userId) {
          setSelectedUser(null);
          setUserTasks([]);
        }
      } catch (err) {
        alert("Failed to delete user");
      }
    }
  };

  // Handle user selection - This will close admin panel and show user's tasks on dashboard
  const handleViewUserTasks = (user) => {
    onSelectUser(user); // Send selected user to App.jsx
    onClose(); // Close the admin panel
  };

  // Handle user selection for viewing tasks within admin panel
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    fetchUserTasks(user.id);
    setViewMode('tasks');
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2><FaUserCog /> Admin Panel</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="admin-panel-tabs">
          <button 
            className={viewMode === 'users' ? 'active' : ''} 
            onClick={() => setViewMode('users')}
          >
            <FaUsers /> All Users
          </button>
          {selectedUser && (
            <button 
              className={viewMode === 'tasks' ? 'active' : ''} 
              onClick={() => setViewMode('tasks')}
            >
              <FaTasks /> {selectedUser.fullname}'s Tasks
            </button>
          )}
        </div>

        <div className="admin-panel-content">
          {viewMode === 'users' && (
            <div className="users-list">
              <h3>All Users ({users.length})</h3>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.fullname}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="actions">
                        {/* View Tasks Button - This will show user's tasks on dashboard */}
                        <button 
                          className="view-tasks-btn"
                          onClick={() => handleViewUserTasks(user)}
                          title="View User's Tasks on Dashboard"
                        >
                          <FaEye /> View Tasks
                        </button>
                        {/* View Details Button - This will show tasks within admin panel */}
                        <button 
                          className="view-details-btn"
                          onClick={() => handleSelectUser(user)}
                          title="View User's Tasks Details"
                        >
                          <FaTasks /> View Details
                        </button>
                        {user.role !== 'admin' && (
                          <button 
                            className="promote-btn"
                            onClick={() => promoteToAdmin(user.id)}
                            title="Make Admin"
                          >
                            <FaUserCog /> Make Admin
                          </button>
                        )}
                        {user.id !== currentUser.id && (
                          <button 
                            className="delete-user-btn"
                            onClick={() => deleteUser(user.id)}
                            title="Delete User"
                          >
                            <FaTrash /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'tasks' && selectedUser && (
            <div className="user-tasks-view">
              <div className="user-info-header">
                <h3>
                  Tasks for: {selectedUser.fullname} 
                  <span className="user-role-badge">{selectedUser.role}</span>
                </h3>
                <button className="back-to-users" onClick={() => setViewMode('users')}>
                  ← Back to Users
                </button>
              </div>
              
              {loading ? (
                <p>Loading tasks...</p>
              ) : (
                <div className="tasks-list">
                  {userTasks.length === 0 ? (
                    <p className="no-tasks">No tasks found for this user.</p>
                  ) : (
                    <table className="tasks-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Title</th>
                          <th>Description</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Deadline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTasks.map(task => (
                          <tr key={task.id}>
                            <td>{task.id}</td>
                            <td>{task.title}</td>
                            <td>{task.description || '-'}</td>
                            <td>
                              <span className={`priority-badge ${task.priority?.toLowerCase()}`}>
                                {task.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${task.status}`}>
                                {task.status}
                              </span>
                            </td>
                            <td>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};