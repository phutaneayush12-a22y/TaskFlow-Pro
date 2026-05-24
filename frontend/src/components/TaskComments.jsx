import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaUser, FaTrash, FaEdit, FaReply, FaPaperPlane, FaSpinner, FaBell } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";

function TaskComments({ taskId, taskTitle, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [allUsers, setAllUsers] = useState([]);
  const textareaRef = useRef(null);
  const mentionTimeoutRef = useRef(null);

  // Fetch all users for mentions (admin only sees all, users see only themselves? No, for mentions we need all users)
  const fetchAllUsers = async () => {
    try {
      // For mentions, we need all users regardless of role
      const res = await axios.get(`http://localhost:5000/users?adminId=${currentUser.id}`);
      setAllUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  // Fetch comments
  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/tasks/${taskId}/comments?userId=${currentUser.id}`);
      setComments(res.data);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchComments();
      fetchAllUsers();
    }
  }, [taskId]);

  // Handle mention detection
  const handleCommentChange = (e) => {
    const value = e.target.value;
    setNewComment(value);
    
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1 && cursorPos - lastAtIndex > 1) {
      const searchTerm = textBeforeCursor.substring(lastAtIndex + 1);
      if (mentionTimeoutRef.current) clearTimeout(mentionTimeoutRef.current);
      
      mentionTimeoutRef.current = setTimeout(() => {
        if (searchTerm.length >= 0) {
          filterUsersForMention(searchTerm);
        }
      }, 300);
    } else {
      setShowMentions(false);
      setMentionSuggestions([]);
    }
  };

  const filterUsersForMention = (searchTerm) => {
    let users = allUsers.filter(u => u.id !== currentUser.id);
    
    if (searchTerm) {
      users = users.filter(u => 
        u.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setMentionSuggestions(users.slice(0, 5));
    setShowMentions(users.length > 0);
    setMentionIndex(0);
  };

  const insertMention = (username) => {
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = newComment.substring(0, cursorPos);
    const textAfterCursor = newComment.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.substring(0, lastAtIndex) + `@${username} ` + textAfterCursor;
    
    setNewComment(newText);
    setShowMentions(false);
    setMentionSuggestions([]);
    textareaRef.current.focus();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      await axios.post(`http://localhost:5000/tasks/${taskId}/comments`, {
        userId: currentUser.id,
        comment: newComment,
        parentCommentId: replyingTo?.id || null,
        userName: currentUser.fullname
      });
      
      setNewComment("");
      setReplyingTo(null);
      fetchComments();
    } catch (err) {
      console.error("Failed to add comment:", err);
      alert("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    
    try {
      await axios.delete(`http://localhost:5000/comments/${commentId}`, {
        data: { userId: currentUser.id, userRole: currentUser.role }
      });
      fetchComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment");
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editingComment?.comment.trim()) return;
    
    try {
      await axios.put(`http://localhost:5000/comments/${commentId}`, {
        userId: currentUser.id,
        comment: editingComment.comment
      });
      setEditingComment(null);
      fetchComments();
    } catch (err) {
      console.error("Failed to edit comment:", err);
      alert("Failed to edit comment");
    }
  };

  const canDeleteComment = (comment) => {
    return currentUser.role === 'admin' || comment.user_id === currentUser.id;
  };

  const canEditComment = (comment) => {
    return comment.user_id === currentUser.id;
  };

  // Handle keyboard navigation for mentions
  const handleKeyDown = (e) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === 'Enter' && mentionSuggestions.length > 0) {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIndex].username);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  return (
    <div className="task-comments">
      <div className="comments-header">
        <h4>💬 Comments ({comments.length})</h4>
      </div>

      {/* Comment Input */}
      <div className="comment-input-wrapper">
        <div className="comment-avatar">
          {currentUser.fullname?.charAt(0).toUpperCase()}
        </div>
        <div className="comment-input-area">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleCommentChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment... Use @ to mention someone"
            rows="3"
            className="comment-textarea"
          />
          
          {/* Mention Suggestions Dropdown */}
          {showMentions && mentionSuggestions.length > 0 && (
            <div className="mention-suggestions">
              {mentionSuggestions.map((user, idx) => (
                <div
                  key={user.id}
                  className={`mention-suggestion ${idx === mentionIndex ? 'active' : ''}`}
                  onClick={() => insertMention(user.username)}
                  onMouseEnter={() => setMentionIndex(idx)}
                >
                  <div className="mention-avatar">
                    {user.fullname?.charAt(0).toUpperCase()}
                  </div>
                  <div className="mention-info">
                    <div className="mention-name">{user.fullname}</div>
                    <div className="mention-username">@{user.username}</div>
                  </div>
                  {user.role === 'admin' && <span className="mention-badge">Admin</span>}
                </div>
              ))}
            </div>
          )}
          
          {replyingTo && (
            <div className="replying-to">
              <span>Replying to <strong>@{replyingTo.user_name}</strong></span>
              <button onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          )}
          
          <div className="comment-actions">
            <button 
              onClick={handleSubmitComment} 
              disabled={!newComment.trim() || submitting}
              className="submit-comment-btn"
            >
              {submitting ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="comments-list">
        {loading ? (
          <div className="comments-loading">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">No comments yet. Be the first to comment!</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-avatar">
                {comment.user_name?.charAt(0).toUpperCase()}
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">{comment.user_name}</span>
                  {comment.user_role === 'admin' && (
                    <span className="comment-badge admin">Admin</span>
                  )}
                  <span className="comment-time">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {editingComment?.id === comment.id ? (
                  <div className="comment-edit">
                    <textarea
                      value={editingComment.comment}
                      onChange={(e) => setEditingComment({ ...editingComment, comment: e.target.value })}
                      rows="2"
                    />
                    <div className="edit-actions">
                      <button onClick={() => handleEditComment(comment.id)}>Save</button>
                      <button onClick={() => setEditingComment(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-text">
                    {comment.comment.split(/(@\w+)/g).map((part, idx) => {
                      if (part.startsWith('@')) {
                        return <span key={idx} className="mention-highlight">{part}</span>;
                      }
                      return part;
                    })}
                  </div>
                )}
                
                <div className="comment-footer">
                  <button 
                    className="comment-reply-btn"
                    onClick={() => setReplyingTo(comment)}
                  >
                    <FaReply /> Reply
                  </button>
                  {canEditComment(comment) && (
                    <button 
                      className="comment-edit-btn"
                      onClick={() => setEditingComment({ id: comment.id, comment: comment.comment })}
                    >
                      <FaEdit /> Edit
                    </button>
                  )}
                  {canDeleteComment(comment) && (
                    <button 
                      className="comment-delete-btn"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <FaTrash /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TaskComments;