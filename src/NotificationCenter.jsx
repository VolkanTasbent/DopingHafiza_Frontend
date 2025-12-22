import { useState, useEffect, useRef } from "react";
import "./NotificationCenter.css";

export default function NotificationCenter({ notifications = [], onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notification-wrapper" ref={notificationRef}>
      <button 
        className="notification-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Bildirimler</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={() => {
                notifications.forEach(n => n.read = true);
                setIsOpen(false);
              }}>
                Tümünü Okundu İşaretle
              </button>
            )}
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <p>Henüz bildirim yok</p>
              </div>
            ) : (
              notifications.map((notification, index) => (
                <div 
                  key={index} 
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => {
                    notification.read = true;
                    if (notification.onClick) {
                      notification.onClick();
                    }
                  }}
                >
                  <div className="notification-icon">{notification.icon || '📢'}</div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{notification.time}</div>
                  </div>
                  {!notification.read && <div className="notification-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}







