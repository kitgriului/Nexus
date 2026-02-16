/**
 * Nexus v2.0 - Full backend integration with WebSocket
 */
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './components/Icons';
import { FeedItem } from './components/FeedItem';
import { JobStatus } from './components/JobStatus';
import * as api from './api/client';
import wsService from './services/websocket';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'ALL' | 'AUDIO' | 'LINK' | 'CHAT'>('ALL');
  const [media, setMedia] = useState<api.MediaItem[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const loadData = async () => {
    try {
      const items = await api.getMedia();
      setMedia(items);
      
      const history = await api.getChatHistory();
      setChatHistory(history);
      
      setTimeout(() => (window as any).lucide?.createIcons(), 0);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  useEffect(() => {
    loadData();
    wsService.connect();
    
    return () => {
      wsService.disconnect();
    };
  }, []);

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
        processAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (e) { 
      alert("Error: Microphone access denied."); 
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const processAudioBlob = async (blob: Blob) => {
    try {
      const file = new File([blob], "recording.webm", { type: blob.type });
      const response = await api.processUpload(file, 'Audio Recording');
      
      // Track job with WebSocket
      setProcessingJobs(prev => [...prev, response.job_id]);
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error}`);
    }
  };

  const processUrl = async (url: string) => {
    try {
      const response = await api.processUrl(url);
      setProcessingJobs(prev => [...prev, response.job_id]);
    } catch (error) {
      console.error('URL processing failed:', error);
      alert(`Processing failed: ${error}`);
    }
  };

  const handleJobComplete = (jobId: string, result: any) => {
    setProcessingJobs(prev => prev.filter(id => id !== jobId));
    loadData();
  };

  const handleJobError = (jobId: string, error: string) => {
    setProcessingJobs(prev => prev.filter(id => id !== jobId));
    alert(`Processing failed: ${error}`);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag === selectedTag ? null : tag);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput.trim();
    setChatInput("");
    setIsTyping(true);
    
    setChatHistory(prev => [...prev, { role: "user", content: userMsg, timestamp: new Date().toISOString() }]);
    
    try {
      const response = await api.chat(userMsg, chatHistory);
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        content: response.answer, 
        sources: response.sources,
        timestamp: new Date().toISOString() 
      }]);
    } catch (error) {
      console.error('Chat failed:', error);
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, something went wrong.", 
        timestamp: new Date().toISOString() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const response = await api.processUpload(file, file.name);
      setProcessingJobs(prev => [...prev, response.job_id]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error}`);
    }
    
    event.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.deleteMedia(id);
      await loadData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete item');
    }
  };

  // Filter media
  const filteredMedia = media.filter(item => {
    if (selectedTag && !item.tags?.includes(selectedTag)) return false;
    if (activeSection === 'AUDIO' && item.media_type !== 'audio') return false;
    if (activeSection === 'LINK' && item.media_type !== 'link') return false;
    return true;
  });

  // Collect all tags
  const allTags = Array.from(new Set(media.flatMap(item => item.tags || [])));

  return (
    <div className="nexus-app">
      {/* Header */}
      <header className="header">
        <h1>📦 Nexus</h1>
        <div className="header-actions">
          <input
            type="file"
            id="file-upload"
            accept="audio/*,video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button onClick={() => document.getElementById('file-upload')?.click()}>
            <Icon name="upload" /> Upload
          </button>
          {!isRecording ? (
            <button onClick={startRecording} className="record-btn">
              <Icon name="mic" /> Record
            </button>
          ) : (
            <button onClick={stopRecording} className="recording-btn">
              <Icon name="stop-circle" /> Stop
            </button>
          )}
        </div>
      </header>

      {/* Processing Jobs */}
      {processingJobs.length > 0 && (
        <div className="processing-panel">
          {processingJobs.map(jobId => (
            <JobStatus
              key={jobId}
              jobId={jobId}
              onComplete={(result) => handleJobComplete(jobId, result)}
              onError={(error) => handleJobError(jobId, error)}
            />
          ))}
        </div>
      )}

      {/* Navigation */}
      <nav className="nav-tabs">
        {['ALL', 'AUDIO', 'LINK', 'CHAT'].map(section => (
          <button
            key={section}
            className={activeSection === section ? 'active' : ''}
            onClick={() => setActiveSection(section as any)}
          >
            {section}
          </button>
        ))}
      </nav>

      {/* Tags Filter */}
      {allTags.length > 0 && activeSection !== 'CHAT' && (
        <div className="tags-filter">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag ${selectedTag === tag ? 'selected' : ''}`}
              onClick={() => handleTagClick(tag)}
            >
              #{tag}
            </button>
          ))}
          {selectedTag && (
            <button className="clear-filter" onClick={() => setSelectedTag(null)}>
              Clear Filter
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <main className="content">
        {activeSection === 'CHAT' ? (
          <div className="chat-container">
            <div className="chat-messages">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <div className="message-content">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <small>Sources:</small>
                      {msg.sources.map((src: any, i: number) => (
                        <div key={i} className="source">
                          {src.title} (score: {src.score.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="chat-message assistant typing">Thinking...</div>}
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Ask anything about your media..."
                disabled={isTyping}
              />
              <button onClick={handleChatSubmit} disabled={isTyping || !chatInput.trim()}>
                <Icon name="send" />
              </button>
            </div>
          </div>
        ) : (
          <div className="media-feed">
            {filteredMedia.length === 0 ? (
              <div className="empty-state">
                <p>No media yet. Record something or add a link!</p>
              </div>
            ) : (
              filteredMedia.map(item => (
                <FeedItem
                  key={item.id}
                  item={item}
                  onDelete={handleDelete}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => setSelectedItemId(item.id === selectedItemId ? null : item.id)}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* URL Input (floating) */}
      {activeSection === 'LINK' && (
        <div className="url-input-container">
          <input
            type="text"
            placeholder="Paste YouTube/podcast/audio URL..."
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
