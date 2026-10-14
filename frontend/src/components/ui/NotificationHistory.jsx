import React, { useState, useEffect, useCallback } from 'react';
import './NotificationHistory.scss';

// Icon mapping for notification types
const iconMap = {
  search: '🔍',
  accept: '✅',
  gps: '📍',
  location: '🚗',
  pickup: '🚐',
  destination: '🏫',
  check: '✅',
  cancel: '❌',
  alert: '🚨',
  delay: '⏱️',
  info: 'ℹ️',
};

export const NotificationHistory = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  isLoading = false,
  onLoadMore,
  hasMore = false,
}) => {
  const [filter, setFilter] = useState('all'); // all, unread, urgent
  const [searchTerm, setSearchTerm] = useState('');

  // Filter notifications
  const filteredNotifications = notifications.filter((notif) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && !notif.read) ||
      (filter === 'urgent' && notif.priority === 'urgent');

    const matchesSearch =
      searchTerm === '' ||
      notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const handleMarkAsRead = useCallback(
    (notificationId, e) => {
      e.stopPropagation();
      onMarkAsRead?.(notificationId);
    },
    [onMarkAsRead]
  );

  const handleDelete = useCallback(
    (notificationId, e) => {
      e.stopPropagation();
      onDelete?.(notificationId);
    },
    [onDelete]
  );

  return (
    <div className="notification-history">
      {/* Header */}
      <div className="notification-history__header">
        <div className="notification-history__title-section">
          <h2 className="notification-history__title">Notifications</h2>
          {unreadCount > 0 && (
            <span className="notification-history__badge">{unreadCount}</span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            className="notification-history__mark-all-btn"
            onClick={onMarkAllAsRead}
            title="Mark all as read"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="notification-history__controls">
        <div className="notification-history__search">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="notification-history__search-input"
          />
          <span className="notification-history__search-icon">🔍</span>
        </div>

        <div className="notification-history__filters">
          <button
            className={`notification-history__filter ${
              filter === 'all' ? 'notification-history__filter--active' : ''
            }`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            className={`notification-history__filter ${
              filter === 'unread' ? 'notification-history__filter--active' : ''
            }`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
          <button
            className={`notification-history__filter ${
              filter === 'urgent' ? 'notification-history__filter--active' : ''
            }`}
            onClick={() => setFilter('urgent')}
          >
            Urgent
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notification-history__list">
        {filteredNotifications.length === 0 ? (
          <div className="notification-history__empty">
            <div className="notification-history__empty-icon">📭</div>
            <p className="notification-history__empty-text">
              {searchTerm ? 'No notifications match your search' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <>
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                className={`notification-history__item notification-history__item--${
                  notification.color
                } ${!notification.read ? 'notification-history__item--unread' : ''}`}
              >
                <div className="notification-history__item-icon">
                  {iconMap[notification.icon] || iconMap.info}
                </div>

                <div className="notification-history__item-content">
                  <div className="notification-history__item-title">
                    {notification.title}
                  </div>
                  <div className="notification-history__item-message">
                    {notification.message}
                  </div>
                  <div className="notification-history__item-meta">
                    <span className="notification-history__item-time">
                      {formatTime(notification.createdAt)}
                    </span>
                    {notification.priority === 'urgent' && (
                      <span className="notification-history__item-priority">
                        🚨 Urgent
                      </span>
                    )}
                  </div>
                </div>

                <div className="notification-history__item-actions">
                  {!notification.read && (
                    <button
                      className="notification-history__item-action"
                      onClick={(e) => handleMarkAsRead(notification._id, e)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="notification-history__item-action notification-history__item-action--delete"
                    onClick={(e) => handleDelete(notification._id, e)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                {!notification.read && (
                  <div className="notification-history__item-unread-indicator"></div>
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="notification-history__load-more">
                <button
                  className="notification-history__load-more-btn"
                  onClick={onLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load more notifications'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="notification-history__footer">
          <button
            className="notification-history__clear-btn"
            onClick={onDeleteAll}
          >
            Clear all notifications
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Format time relative to now
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default NotificationHistory;
