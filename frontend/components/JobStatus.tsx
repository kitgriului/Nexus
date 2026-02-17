import React from 'react';

interface JobStatusProps {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

export const JobStatus: React.FC<JobStatusProps> = ({ jobId, status, progress }) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'pending':
        return { emoji: '⏳', text: 'Pending', color: '#fbb034' };
      case 'processing':
        return { emoji: '⚙️', text: `Processing${progress ? ` (${progress}%)` : ''}`, color: '#4b90e2' };
      case 'completed':
        return { emoji: '✅', text: 'Completed', color: '#7ed321' };
      case 'error':
        return { emoji: '❌', text: 'Error', color: '#d0021b' };
      default:
        return { emoji: '❓', text: 'Unknown', color: '#999' };
    }
  };

  const info = getStatusInfo();

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${info.color}20`,
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Status Icon */}
      <div style={{ fontSize: '20px', flexShrink: 0, animation: status === 'processing' ? 'spin 1s linear infinite' : 'none' }}>
        {info.emoji}
      </div>

      {/* Status Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
          {info.text}
        </div>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div
            style={{
              width: '100%',
              height: '4px',
              background: '#e5e5e5',
              borderRadius: '2px',
              marginTop: '6px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: info.color,
                width: `${progress}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* ID (small) */}
      <div style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {jobId.slice(0, 8)}...
      </div>
    </div>
  );
};

      {status.status === 'failed' && status.error && (
        <div className="error-message">
          {status.error}
        </div>
      )}
    </div>
  );
};

export default JobStatus;
