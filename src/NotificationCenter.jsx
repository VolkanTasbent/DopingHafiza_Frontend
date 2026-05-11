import { useState, useEffect, useRef } from "react";
import "./NotificationCenter.css";

export default function NotificationCenter({ notifications = [], onNotificationsChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", close);
      document.addEventListener("touchstart", close, { passive: true });
    }

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const patch = (updater) => {
    if (typeof onNotificationsChange === "function") {
      onNotificationsChange(updater);
    }
  };

  const markAllRead = () => {
    patch((prev) => prev.map((n) => ({ ...n, read: true })));
    setIsOpen(false);
  };

  const markOneRead = (id) => {
    if (id == null) return;
    patch((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="notification-wrapper" ref={notificationRef}>
      <button
        type="button"
        className="notification-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Bildirimler"
      >
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <>
          <div
            className="notification-backdrop"
            aria-hidden
            onClick={() => setIsOpen(false)}
          />
          <div
            className="notification-dropdown"
            role="dialog"
            aria-label="Bildirim listesi"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-header">
              <h3>Bildirimler</h3>
              {unreadCount > 0 && (
                <button type="button" className="mark-all-read" onClick={markAllRead}>
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
                notifications.map((notification, index) => {
                  const key = notification.id ?? `n-${index}`;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      className={`notification-item ${!notification.read ? "unread" : ""}`}
                      onClick={() => {
                        if (notification.id != null) markOneRead(notification.id);
                        else patch((prev) => prev.map((n, i) => (i === index ? { ...n, read: true } : n)));
                        if (notification.onClick) notification.onClick();
                        setIsOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <div className="notification-icon">{notification.icon || "📢"}</div>
                      <div className="notification-content">
                        <div className="notification-title">{notification.title}</div>
                        <div className="notification-message">{notification.message}</div>
                        {notification.time ? (
                          <div className="notification-time">{notification.time}</div>
                        ) : null}
                      </div>
                      {!notification.read && <div className="notification-dot" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
