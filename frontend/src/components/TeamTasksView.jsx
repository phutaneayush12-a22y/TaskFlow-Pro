import { useState, useEffect } from "react";
import axios from "axios";
import { FaTasks, FaUsers, FaCalendarAlt, FaClock, FaComment, FaPlus, FaTrash, FaEdit, FaCrown, FaUserMinus } from "react-icons/fa";
import { format, isToday, isBefore } from "date-fns";

function TeamTasksView({ team, user, onTaskClick, onRefresh, onTeamDeleted }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(null);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    deadline: ""
  });

  // Check if current user is admin
  const isAdmin = user.role === 'admin';
  const isTeamLead = members.find(m => m.id === user.id)?.team_role === 'lead';

  // Fetch team tasks
  const fetchTeamTasks = async () => {
    if (!team || !user) return;
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/teams/${team.id}/tasks?userId=${user.id}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to fetch team tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch team members
  const fetchTeamMembers = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/teams/${team.id}?userId=${user.id}`);
      setMembers(res.data.members || []);
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  };

  useEffect(() => {
    if (team) {
      fetchTeamTasks();
      fetchTeamMembers();
    }
  }, [team, onRefresh]);

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      alert("Please enter task title");
      return;
    }

    try {
      await axios.post(`http://localhost:5000/teams/${team.id}/tasks`, {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        deadline: newTask.deadline,
        created_by: user.id,
        assigned_by: user.id,
        adminId: user.id
      });
      alert("Task created successfully!");
      setShowAddTask(false);
      setNewTask({ title: "", description: "", priority: "MEDIUM", deadline: "" });
      fetchTeamTasks();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create task");
    }
  };

  // Delete team task (Admin only)
  const handleDeleteTeamTask = async (taskId) => {
    if (!isAdmin) {
      alert("Only admin can delete team tasks");
      return;
    }
    
    try {
      await axios.delete(`http://localhost:5000/tasks/${taskId}`, {
        data: { adminId: user.id }
      });
      alert("Task deleted successfully!");
      setShowDeleteTaskConfirm(null);
      fetchTeamTasks();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete task");
    }
  };

  // Delete entire team (Admin only)
  const handleDeleteTeam = async () => {
    if (!isAdmin) {
      alert("Only admin can delete teams");
      return;
    }
    
    try {
      await axios.delete(`http://localhost:5000/teams/${team.id}`, {
        data: { adminId: user.id }
      });
      alert("Team deleted successfully!");
      setShowDeleteConfirm(false);
      if (onTeamDeleted) {
        onTeamDeleted();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete team");
    }
  };

  // Remove member from team (Admin only)
  const handleRemoveMember = async (memberId, memberName) => {
    if (!isAdmin) {
      alert("Only admin can remove members");
      return;
    }
    
    if (memberId === user.id) {
      alert("You cannot remove yourself. Use Delete Team instead.");
      return;
    }
    
    try {
      await axios.delete(`http://localhost:5000/teams/${team.id}/members/${memberId}`, {
        data: { adminId: user.id }
      });
      alert(`${memberName} removed from team`);
      setShowRemoveMemberConfirm(null);
      fetchTeamMembers();
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to remove member");
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'HIGH': return '#dc2626';
      case 'MEDIUM': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return '✅';
    if (status === 'inprogress') return '🔄';
    return '⏳';
  };

  const todayTasks = tasks.filter(t => t.deadline && isToday(new Date(t.deadline)));
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.deadline && isBefore(new Date(t.deadline), new Date()));
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="team-tasks-view">
      {/* Team Header with Admin Actions */}
      <div className="team-header">
        <div className="team-header-info">
          <div className="team-icon-large">👥</div>
          <div>
            <h2>{team.name}</h2>
            <p>{team.description || 'No description'}</p>
          </div>
        </div>
        <div className="team-stats">
          <div className="team-stat">
            <div className="stat-value">{members.length}</div>
            <div className="stat-label">Members</div>
          </div>
          <div className="team-stat">
            <div className="stat-value">{tasks.length}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="team-stat">
            <div className="stat-value">{completedTasks.length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="team-stat">
            <div className="stat-value">{pendingTasks.length}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        
        {/* Admin Actions - Delete Team Button */}
        {isAdmin && (
          <div className="team-admin-actions">
            <button className="delete-team-btn" onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash /> Delete Team
            </button>
          </div>
        )}
      </div>

      {/* Team Members Section with Remove Option for Admin */}
      <div className="team-members-section">
        <h3><FaUsers /> Team Members ({members.length})</h3>
        <div className="team-members-list">
          {members.map(member => (
            <div key={member.id} className="team-member-card">
              <div className="member-avatar">{member.fullname?.charAt(0)}</div>
              <div className="member-info">
                <div className="member-name">{member.fullname}</div>
                <div className="member-badge">
                  {member.team_role === 'lead' ? '👑 Lead' : '👤 Member'}
                  {member.role === 'admin' && ' • Admin'}
                </div>
              </div>
              {isAdmin && member.id !== user.id && (
                <button 
                  className="remove-member-btn" 
                  onClick={() => setShowRemoveMemberConfirm(member)}
                  title="Remove member"
                >
                  <FaUserMinus />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Task Button */}
      <div className="add-team-task">
        {(isAdmin || isTeamLead) && (
          <button className="btn-primary" onClick={() => setShowAddTask(true)}>
            <FaPlus /> Add Team Task
          </button>
        )}
      </div>

      {/* Create Task Modal */}
      {showAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="modal add-task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaPlus /> Create Team Task</h2>
              <button className="close-btn" onClick={() => setShowAddTask(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Task Title *</label>
                <input 
                  type="text" 
                  placeholder="Enter task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  placeholder="Enter task description..."
                  rows="3"
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select value={newTask.priority} onChange={(e) => setNewTask({...newTask, priority: e.target.value})}>
                    <option value="HIGH">🔴 High Priority</option>
                    <option value="MEDIUM">🟡 Medium Priority</option>
                    <option value="LOW">🟢 Low Priority</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input 
                    type="datetime-local" 
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({...newTask, deadline: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddTask(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateTask}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaTrash /> Delete Team</h2>
              <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the team <strong>"{team.name}"</strong>?</p>
              <p className="warning-text">⚠️ This action cannot be undone. All team tasks will also be deleted.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteTeam}>Delete Team</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {showRemoveMemberConfirm && (
        <div className="modal-overlay" onClick={() => setShowRemoveMemberConfirm(null)}>
          <div className="modal delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaUserMinus /> Remove Member</h2>
              <button className="close-btn" onClick={() => setShowRemoveMemberConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove <strong>{showRemoveMemberConfirm.fullname}</strong> from team <strong>"{team.name}"</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRemoveMemberConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleRemoveMember(showRemoveMemberConfirm.id, showRemoveMemberConfirm.fullname)}>Remove Member</button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List with Delete Option for Admin */}
      <div className="team-tasks-list">
        <h3><FaTasks /> Team Tasks ({tasks.length})</h3>
        
        {loading ? (
          <div className="loading-tasks">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-tasks">No tasks assigned to this team yet.</div>
        ) : (
          <>
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div className="task-category overdue">
                <h4>⚠️ Overdue ({overdueTasks.length})</h4>
                {overdueTasks.map(task => (
                  <div key={task.id} className="team-task-card">
                    <div className="task-status" onClick={() => onTaskClick(task)}>{getStatusIcon(task.status)}</div>
                    <div className="task-details" onClick={() => onTaskClick(task)}>
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        <span className="task-priority" style={{ color: getPriorityColor(task.priority) }}>
                          {task.priority}
                        </span>
                        <span className="task-deadline">📅 Due: {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div className="task-progress" onClick={() => onTaskClick(task)}>
                      <div className="progress-circle">{task.progress || 0}%</div>
                    </div>
                    {isAdmin && (
                      <button 
                        className="task-delete-btn" 
                        onClick={() => setShowDeleteTaskConfirm(task)}
                        title="Delete task"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Today's Tasks */}
            {todayTasks.length > 0 && (
              <div className="task-category today">
                <h4>📅 Today ({todayTasks.length})</h4>
                {todayTasks.map(task => (
                  <div key={task.id} className="team-task-card">
                    <div className="task-status" onClick={() => onTaskClick(task)}>{getStatusIcon(task.status)}</div>
                    <div className="task-details" onClick={() => onTaskClick(task)}>
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        <span className="task-priority" style={{ color: getPriorityColor(task.priority) }}>
                          {task.priority}
                        </span>
                        <span className="task-time">🕐 {format(new Date(task.deadline), 'h:mm a')}</span>
                      </div>
                    </div>
                    <div className="task-progress" onClick={() => onTaskClick(task)}>
                      <div className="progress-circle">{task.progress || 0}%</div>
                    </div>
                    {isAdmin && (
                      <button 
                        className="task-delete-btn" 
                        onClick={() => setShowDeleteTaskConfirm(task)}
                        title="Delete task"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Other Tasks */}
            <div className="task-category all">
              <h4>📋 All Tasks ({tasks.length - overdueTasks.length - todayTasks.length})</h4>
              {tasks.filter(t => !overdueTasks.includes(t) && !todayTasks.includes(t)).map(task => (
                <div key={task.id} className="team-task-card">
                  <div className="task-status" onClick={() => onTaskClick(task)}>{getStatusIcon(task.status)}</div>
                  <div className="task-details" onClick={() => onTaskClick(task)}>
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span className="task-priority" style={{ color: getPriorityColor(task.priority) }}>
                        {task.priority}
                      </span>
                      {task.deadline && (
                        <span className="task-deadline">📅 Due: {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <div className="task-progress" onClick={() => onTaskClick(task)}>
                    <div className="progress-circle">{task.progress || 0}%</div>
                  </div>
                  {isAdmin && (
                    <button 
                      className="task-delete-btn" 
                      onClick={() => setShowDeleteTaskConfirm(task)}
                      title="Delete task"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Task Confirmation Modal */}
      {showDeleteTaskConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteTaskConfirm(null)}>
          <div className="modal delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaTrash /> Delete Task</h2>
              <button className="close-btn" onClick={() => setShowDeleteTaskConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete the task <strong>"{showDeleteTaskConfirm.title}"</strong>?</p>
              <p className="warning-text">⚠️ This action cannot be undone. All comments on this task will also be deleted.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteTaskConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteTeamTask(showDeleteTaskConfirm.id)}>Delete Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamTasksView;