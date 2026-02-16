import React, { useEffect, useState } from 'react';
import wsService, { JobStatusUpdate } from '../services/websocket';

interface JobStatusProps {
  jobId: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export const JobStatus: React.FC<JobStatusProps> = ({ jobId, onComplete, onError }) => {
  const [status, setStatus] = useState<JobStatusUpdate | null>(null);

  useEffect(() => {
    const handleUpdate = (update: JobStatusUpdate) => {
      setStatus(update);

      if (update.status === 'completed' && onComplete) {
        onComplete(update.result);
      }

      if (update.status === 'failed' && onError) {
        onError(update.error || 'Unknown error');
      }
    };

    wsService.subscribe(jobId, handleUpdate);

    return () => {
      wsService.unsubscribe(jobId, handleUpdate);
    };
  }, [jobId, onComplete, onError]);

  if (!status) {
    return (
      <div className="job-status pending">
        <div className="spinner"></div>
        <span>Initializing...</span>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusText = () => {
    if (status.stage) {
      return status.stage;
    }
    return status.status.charAt(0).toUpperCase() + status.status.slice(1);
  };

  return (
    <div className={`job-status ${status.status}`}>
      <div className="status-header">
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {status.progress !== undefined && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${status.progress}%` }}
          />
          <span className="progress-text">{status.progress}%</span>
        </div>
      )}

      {status.status === 'failed' && status.error && (
        <div className="error-message">
          {status.error}
        </div>
      )}
    </div>
  );
};

export default JobStatus;
