import React from 'react';
import { MediaItem } from '../types';

interface FeedItemProps {
  item: MediaItem;
  onClick: (id: string) => void;
  onTagClick: (tag: string) => void;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item, onClick, onTagClick }) => {
  const getEmoji = () => {
    if (item.type === 'youtube' || item.type === 'video') return '▶️';
    if (item.type === 'audio') return '🎙️';
    if (item.type === 'chat_session') return '💬';
    return '📄';
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this item?')) {
      // TODO: implement delete
    }
  };

  return (
    <div
      className="feed-item"
      onClick={() => onClick(item.id)}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        padding: '16px',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '12px',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.borderColor = '#d5d5d5';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5';
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div
          style={{
            fontSize: '32px',
            flexShrink: 0,
            opacity: item.status === 'processing' ? 0.6 : 1,
          }}
        >
          {getEmoji()}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + Date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: '#1a1a1a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </h3>
            <span
              style={{
                fontSize: '11px',
                color: '#999',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {new Date(item.created_at || Date.now()).toLocaleDateString()}
            </span>
          </div>

          {/* Summary */}
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '12px',
              color: '#666',
              lineHeight: '1.4',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.ai_summary || (item.status === 'processing' ? '⏳ Processing...' : 'No summary')}
          </p>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {item.tags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(tag);
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#f5f5f5',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#000';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = '#000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.color = '#666';
                    e.currentTarget.style.borderColor = '#e5e5e5';
                  }}
                >
                  #{tag}
                </button>
              ))}
              {item.tags.length > 3 && (
                <span style={{ fontSize: '11px', color: '#999', paddingTop: '4px' }}>
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Status Badge */}
          {item.status && item.status !== 'completed' && (
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#999',
                fontWeight: 500,
              }}
            >
              Status: <strong>{item.status}</strong>
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            opacity: 0.4,
            transition: 'opacity 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.4';
          }}
          title="Delete item"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
