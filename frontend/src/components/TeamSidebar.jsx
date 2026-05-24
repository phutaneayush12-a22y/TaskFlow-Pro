import { useState, useEffect } from "react";
import axios from "axios";
import { FaUsers, FaPlus, FaEye, FaChevronDown, FaChevronRight, FaUserPlus } from "react-icons/fa";

function TeamSidebar({ user, onSelectTeam, selectedTeamId, refreshTrigger, onTeamDeleted }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: "", description: "", memberIds: [] });

  // Fetch user's teams
  const fetchMyTeams = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/teams/my-teams?userId=${user.id}`);
      setTeams(res.data);
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all users (for admin create team)
  const fetchAllUsers = async () => {
    if (user?.role !== 'admin') return;
    try {
      const res = await axios.get(`http://localhost:5000/users?adminId=${user.id}`);
      setAllUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchMyTeams();
    if (user?.role === 'admin') {
      fetchAllUsers();
    }
  }, [user, refreshTrigger]);

  // Refresh when team is deleted
  useEffect(() => {
    if (onTeamDeleted) {
      fetchMyTeams();
    }
  }, [onTeamDeleted]);

  const handleTeamClick = (team) => {
    onSelectTeam(team);
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      alert("Please enter a team name");
      return;
    }

    try {
      await axios.post("http://localhost:5000/teams", {
        name: newTeam.name,
        description: newTeam.description,
        memberIds: newTeam.memberIds,
        adminId: user.id
      });
      alert("Team created successfully!");
      setShowCreateModal(false);
      setNewTeam({ name: "", description: "", memberIds: [] });
      fetchMyTeams();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create team");
    }
  };

  const toggleMember = (userId) => {
    setNewTeam(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter(id => id !== userId)
        : [...prev.memberIds, userId]
    }));
  };

  return (
    <>
      <div className="sidebar-section">
        <div className="sidebar-title" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
          {expanded ? <FaChevronDown /> : <FaChevronRight />}
          <FaUsers /> <span>My Teams</span>
          {user?.role === 'admin' && (
            <button className="add-team-btn" onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }} title="Create Team">
              <FaPlus />
            </button>
          )}
        </div>
        
        {expanded && (
          <ul className="sidebar-menu teams-list">
            {loading ? (
              <li className="team-loading">Loading teams...</li>
            ) : teams.length === 0 ? (
              <li className="no-teams">No teams yet</li>
            ) : (
              teams.map(team => (
                <li 
                  key={team.id} 
                  className={`team-item ${selectedTeamId === team.id ? 'active' : ''}`}
                  onClick={() => handleTeamClick(team)}
                >
                  <div className="team-icon">👥</div>
                  <div className="team-info">
                    <div className="team-name">{team.name}</div>
                    <div className="team-meta">{team.member_count} members • {team.user_role === 'lead' ? 'Lead' : 'Member'}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal create-team-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FaUsers /> Create New Team</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Team Name *</label>
                <input 
                  type="text" 
                  placeholder="Enter team name..." 
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  placeholder="Enter team description..." 
                  rows="3"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({...newTeam, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Select Team Members</label>
                <div className="member-select-list">
                  {allUsers.filter(u => u.id !== user.id).map(member => (
                    <label key={member.id} className="member-checkbox">
                      <input 
                        type="checkbox" 
                        checked={newTeam.memberIds.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                      />
                      <div className="member-avatar">{member.fullname?.charAt(0)}</div>
                      <div className="member-details">
                        <span className="member-name">{member.fullname}</span>
                        <span className="member-role">{member.role === 'admin' ? 'Admin' : 'User'}</span>
                        <span className="member-id">{member.unique_id}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="selected-count">
                  Selected: <strong>{newTeam.memberIds.length}</strong> member(s)
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateTeam}>Create Team</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TeamSidebar;