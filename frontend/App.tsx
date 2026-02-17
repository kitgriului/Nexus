/**
 * Nexus v2.1 - AI Media Archive
 * Complete redesign with Apple/OpenAI aesthetic
 */

import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import { Icon } from './components/Icons';
import { FeedItem } from './components/FeedItem';
import { JobStatus } from './components/JobStatus';
import * as api from './apiClient/client';
import wsService from './services/websocket';

type Section = 'ALL' | 'AUDIO' | 'LINK' | 'CHAT';

interface ProcessingJob {
  id: string;
  mediaId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('ALL');
  const [media, setMedia] = useState<api.MediaItem[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const normalizeJobStatus = (status: string): ProcessingJob['status'] => {
    if (status === 'completed') return 'completed';
    if (status === 'error' || status === 'failed') return 'error';
    if (status === 'pending') return 'pending';
    return 'processing';
  };

  const trackJob = (jobId: string, mediaId: string) => {
    setProcessingJobs((prev) => [
      ...prev,
      { id: jobId, mediaId, status: 'pending' },
    ]);

    api
      .pollJobStatus(mediaId, (jobStatus) => {
        const normalized = normalizeJobStatus(jobStatus.status);
        setProcessingJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status: normalized,
                  progress: jobStatus.progress_percent,
                }
              : job
          )
        );

        if (normalized === 'completed' || normalized === 'error') {
          setTimeout(() => {
            setProcessingJobs((prev) => prev.filter((j) => j.id !== jobId));
          }, 3000);
        }
      })
      .then(() => loadData())
      .catch((err) => {
        setProcessingJobs((prev) =>
          prev.map((job) =>
            job.id === jobId ? { ...job, status: 'error' } : job
          )
        );
        setError(`Processing failed: ${err}`);
      });
  };

  // Load initial data
  const loadData = async () => {
    try {
      setError(null);
      const items = await api.getMedia();
      setMedia(items);

      if (activeSection === 'CHAT') {
        const history = await api.getChatHistory();
        setChatHistory(history);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    }
  };

  // Initialize
  useEffect(() => {
    loadData();
    wsService.connect();

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Refresh data when section changes
  useEffect(() => {
    loadData();
  }, [activeSection]);

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        handleAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied');
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const handleAudioBlob = async (blob: Blob) => {
    try {
      const file = new File([blob], 'recording.webm', { type: blob.type });
      const response = await api.processUpload(file, 'Audio Recording');
      trackJob(response.job_id, response.media_id);
    } catch (err) {
      setError('Failed to upload recording');
      console.error(err);
    }
  };

  // File Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const response = await api.processUpload(file, file.name);
      trackJob(response.job_id, response.media_id);
    } catch (err) {
      setError(`Upload failed: ${err}`);
      console.error(err);
    }

    event.target.value = '';
  };

  // URL Processing
  const processUrl = async (url: string) => {
    try {
      const response = await api.processUrl(url, url);
      trackJob(response.job_id, response.media_id);
    } catch (err) {
      setError(`Failed to process URL: ${err}`);
      console.error(err);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await api.deleteMedia(mediaId);
      setMedia((prev) => prev.filter((item) => item.id !== mediaId));
      setProcessingJobs((prev) => prev.filter((job) => job.mediaId !== mediaId));
    } catch (err) {
      setError(`Failed to delete item: ${err}`);
      console.error(err);
    }
  };

  // Chat
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isTyping) return;

    try {
      setIsTyping(true);
      setError(null);

      const userMsg = { role: 'user', text: chatInput };
      setChatHistory((prev) => [...prev, userMsg]);
      setChatInput('');

      const response = await api.chat({ message: chatInput });

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.response,
          context_media_ids: response.context_media_ids,
        },
      ]);
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  // Filters
  const filteredMedia = media.filter((item) => {
    if (selectedTag && !item.tags?.includes(selectedTag)) return false;
    if (activeSection === 'AUDIO' && item.type !== 'audio') return false;
    if (activeSection === 'LINK' && item.type === 'audio') return false;
    return true;
  });

  const allTags = Array.from(new Set(media.flatMap((item) => item.tags || [])));

  return (
    <div className="nexus-app">
      {/* Header */}
      <header className="app-header">
        <h1>
          <span>🔍</span> Nexus
        </h1>

        <div className="nav-tabs">
          {(['ALL', 'AUDIO', 'LINK', 'CHAT'] as Section[]).map((section) => (
            <button
              key={section}
              className={`nav-tab ${activeSection === section ? 'active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              {section}
            </button>
          ))}
        </div>

        <div className="header-controls">
          <input
            type="file"
            id="file-upload"
            accept="audio/*,video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn"
            onClick={() => document.getElementById('file-upload')?.click()}
            title="Upload audio or video file"
          >
            <span>📤</span> Upload
          </button>

          {!isRecording ? (
            <button
              className="btn record"
              onClick={startRecording}
              title="Start recording audio"
            >
              <span>🎙️</span> Record
            </button>
          ) : (
            <button
              className="btn record"
              onClick={stopRecording}
              title="Stop recording"
              style={{ background: '#c53030' }}
            >
              <span>⏹️</span> Stop
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '12px 24px',
            background: '#fee',
            color: '#c53030',
            border: '1px solid #fcc',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Sidebar with Tags */}
        {activeSection !== 'CHAT' && allTags.length > 0 && (
          <div className="sidebar">
            <div className="sidebar-header">Tags</div>
            <div className="tag-list">
              <button
                className={`tag-item ${selectedTag === null ? 'active' : ''}`}
                onClick={() => setSelectedTag(null)}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`tag-item ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Section */}
        {activeSection === 'CHAT' ? (
          <div className="chat-section" style={{ flex: 1 }}>
            <div className="chat-messages">
              {chatHistory.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">💬</div>
                  <div>Ask questions about your media archive...</div>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.role}`}>
                    <div className="message-bubble">
                      {msg.text}
                      {msg.context_media_ids && msg.context_media_ids.length > 0 && (
                        <div className="message-sources">
                          <small>Sources: {msg.context_media_ids.join(', ')}</small>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="chat-message assistant">
                  <div className="message-bubble">Thinking...</div>
                </div>
              )}
            </div>

            <div className="chat-input-section">
              <input
                type="text"
                className="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Ask anything about your archive..."
                disabled={isTyping}
              />
              <button
                className="send-btn"
                onClick={handleChatSubmit}
                disabled={isTyping || !chatInput.trim()}
              >
                <span>→</span>
              </button>
            </div>
          </div>
        ) : (
          /* Feed Section */
          <div className="feed-container">
            {/* Processing Jobs */}
            {processingJobs.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {processingJobs.map((job) => (
                  <JobStatus key={job.id} jobId={job.id} status={job.status} progress={job.progress} />
                ))}
              </div>
            )}

            {/* Media Feed */}
            {filteredMedia.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div>
                  {media.length === 0
                    ? 'No media yet. Record something or add a link!'
                    : 'No items match your filter.'}
                </div>
              </div>
            ) : (
              filteredMedia.map((item) => (
                <FeedItem
                  key={item.id}
                  item={item}
                  onClick={() => {}}
                  onTagClick={(tag) => setSelectedTag(tag)}
                  onDelete={handleDeleteMedia}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* URL Input (floating) */}
      {activeSection === 'LINK' && (
        <div className="url-input-container">
          <input
            type="text"
            placeholder="Paste YouTube/podcast URL..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const url = (e.target as HTMLInputElement).value.trim();
                if (url) {
                  processUrl(url);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
