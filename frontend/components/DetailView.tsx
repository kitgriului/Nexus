import React from 'react';
import { MediaItem } from '../apiClient/client';

interface DetailViewProps {
  item: MediaItem;
  onClose: () => void;
}

export const DetailView: React.FC<DetailViewProps> = ({ item, onClose }) => {
  const getEmoji = () => {
    if (item.type === 'youtube' || item.type === 'video') return '▶️';
    if (item.type === 'audio') return '🎙️';
    if (item.type === 'chat_session') return '💬';
    return '📄';
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m ${secs}s`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '32px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ fontSize: '48px' }}>{getEmoji()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#1a1a1a',
                  wordBreak: 'break-word',
                }}
              >
                {item.title}
              </h1>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                <span>{new Date(item.created_at || Date.now()).toLocaleDateString()}</span>
                {item.duration > 0 && <span>{formatTime(item.duration)}</span>}
                {item.type && (
                  <span>
                    Type: <strong>{item.type}</strong>
                  </span>
                )}
                {item.status && (
                  <span>
                    Status: <strong>{item.status}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#999',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#999';
            }}
          >
            ✕
          </button>
        </div>

        {/* Summary Section */}
        {item.ai_summary && (
          <div style={{ marginBottom: '24px' }}>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              Summary
            </h2>
            <div
              style={{
                background: '#f9f9f9',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#333',
                borderLeft: '4px solid #007AFF',
              }}
            >
              {item.ai_summary}
            </div>
          </div>
        )}

        {/* Tags Section */}
        {item.tags && item.tags.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              Topics
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-block',
                    background: '#f0f0f0',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#333',
                    fontWeight: 500,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Full Transcript Section */}
        {item.raw_text && (
          <div>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              Full Transcript
            </h2>
            <div
              style={{
                background: '#f9f9f9',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '13px',
                lineHeight: '1.8',
                color: '#333',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '400px',
                overflow: 'auto',
                fontFamily: '"Monaco", "Courier New", monospace',
              }}
            >
              {item.raw_text}
            </div>
          </div>
        )}

        {/* Alternative: Show speaker turns if available */}
        {(!item.raw_text || item.raw_text.length === 0) && item.transcript && Array.isArray(item.transcript) && item.transcript.length > 0 && (
          <div>
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
              }}
            >
              Transcript
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {item.transcript.map((turn, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f9f9f9',
                    padding: '12px',
                    borderRadius: '8px',
                    borderLeft: '3px solid #007AFF',
                  }}
                >
                  {typeof turn === 'object' && turn.speaker && (
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#007AFF',
                        marginBottom: '4px',
                      }}
                    >
                      {turn.speaker}
                    </div>
                  )}
                  <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6' }}>
                    {typeof turn === 'object' && turn.text ? turn.text : String(turn)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No content */}
        {!item.raw_text && (!item.transcript || item.transcript.length === 0) && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: '#999',
            }}
          >
            No transcript available yet
          </div>
        )}
      </div>
    </div>
  );
};
