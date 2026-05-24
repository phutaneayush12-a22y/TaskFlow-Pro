import { useState, useEffect } from 'react';
import { FaBell, FaCheckCircle, FaPlus, FaEdit } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';

export const ActivityFeed = ({ activities }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setUnreadCount(activities.filter(a => !a.read).length);
  }, [activities]);

  const getIcon = (type) => {
    switch(type) {
      case 'complete': return <FaCheckCircle style={{ color: '#10b981' }} />;
      case 'create': return <FaPlus style={{ color: '#6366f1' }} />;
      case 'update': return <FaEdit style={{ color: '#f59e0b' }} />;
      default: return <FaBell />;
    }
  };

  return (
    <div className="activity-feed">
      <button className="feed-bell" onClick={() => setIsOpen(!isOpen)}>
        <FaBell />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      
      {isOpen && (
        <div className="feed-dropdown">
          <h3>Recent Activity</h3>
          <div className="feed-list">
            {activities.length === 0 ? (
              <p className="no-activities">No activities yet</p>
            ) : (
              activities.map((activity, index) => (
                <div key={index} className="feed-item">
                  {getIcon(activity.type)}
                  <div className="feed-content">
                    <p>{activity.message}</p>
                    <small>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};