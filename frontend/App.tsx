import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';
import { FeedView } from './components/FeedView';
import * as api from './apiClient/client';
import { MediaItem, Category, ChatMessage, SearchResult, ActiveView, ProcessingJobUI } from './types';

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    note: '📝', audio: '🎙️', video: '🎬', youtube: '▶️',
    web: '🌐', podcast: '🎧', instagram: '📸',
  };
  return icons[type] || '📄';
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

const Sidebar: React.FC<{
  activeView: ActiveView;
  onViewChange: (v: ActiveView) => void;
  categories: Category[];
  selectedCategory: string | null;
  onCategorySelect: (id: string | null) => void;
  onCreateCategory: () => void;
}> = ({ activeView, onViewChange, categories, selectedCategory, onCategorySelect, onCreateCategory }) => {
  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'chat', label: '💬 Чат' },
    { id: 'notes', label: '📝 Заметки' },
    { id: 'media', label: '📦 Медиа' },
    { id: 'search', label: '🔍 Поиск' },
    { id: 'feeds', label: '📡 Фиды' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⬡</span>
        <span className="logo-text">Nexus</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ id, label }) => (
          <button key={id} className={`nav-item${activeView === id ? ' active' : ''}`} onClick={() => onViewChange(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Папки</span>
          <button className="icon-btn" onClick={onCreateCategory} title="Новая папка">＋</button>
        </div>
        <button className={`folder-item${selectedCategory === null ? ' active' : ''}`} onClick={() => onCategorySelect(null)}>
          📂 Все
        </button>
        {categories.map((cat) => (
          <button key={cat.id} className={`folder-item${selectedCategory === cat.id ? ' active' : ''}`} onClick={() => onCategorySelect(cat.id)}>
            {cat.icon || '📁'} {cat.name}
            <span className="folder-count">{cat.item_count}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatHistory(0, 50).then((hist) => setMessages([...hist].reverse())).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.chat(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.response, context_media_ids: res.context_media_ids }]);
    } catch (e: unknown) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : 'Ошибка'}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="chat-view">
      <div className="view-header">
        <h2>Чат с архивом</h2>
        <button className="btn-ghost" onClick={() => { api.clearChatHistory().catch(() => {}); setMessages([]); }}>Очистить</button>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>Задайте вопрос о своих заметках, медиа или ссылках.</p>
            <p className="empty-hint">Используется RAG — ответы основаны на вашем контенте.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="bubble-content">{msg.text}</div>
            {msg.context_media_ids && msg.context_media_ids.length > 0 && (
              <div className="bubble-sources">Источники: {msg.context_media_ids.length} элем.</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant">
            <div className="bubble-content typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Спросите что-нибудь о вашем архиве..."
          disabled={loading}
        />
        <button className="btn-primary send-btn" onClick={handleSend} disabled={loading || !input.trim()}>↑</button>
      </div>
    </div>
  );
};

const NotesView: React.FC<{ selectedCategory: string | null; categories: Category[] }> = ({ selectedCategory, categories }) => {
  const [notes, setNotes] = useState<MediaItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [catId, setCatId] = useState('');
  const [tags, setTags] = useState('');

  const load = useCallback(() => {
    api.getNotes({ category_id: selectedCategory || undefined }).then(setNotes).catch(() => {});
  }, [selectedCategory]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditItem(null); setTitle(''); setContent(''); setCatId(selectedCategory || ''); setTags(''); setShowForm(true);
  };
  const openEdit = (note: MediaItem) => {
    setEditItem(note); setTitle(note.title); setContent(note.raw_text || '');
    setCatId(note.category_id || ''); setTags((note.tags || []).join(', ')); setShowForm(true);
  };
  const handleSave = async () => {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (editItem) await api.deleteNote(editItem.id).catch(() => {});
    await api.createNote({ title: title || 'Без названия', content, tags: tagList, category_id: catId || undefined });
    setShowForm(false); load();
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    await api.deleteNote(id).catch(() => {}); load();
  };

  return (
    <div className="content-view">
      <div className="view-header">
        <h2>Заметки</h2>
        <button className="btn-primary" onClick={openNew}>＋ Новая заметка</button>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editItem ? 'Редактировать' : 'Новая заметка'}</h3>
            <input className="form-input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="form-textarea" placeholder="Содержимое заметки..." value={content} onChange={(e) => setContent(e.target.value)} rows={8} />
            <input className="form-input" placeholder="Теги (через запятую)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <select className="form-select" value={catId} onChange={(e) => setCatId(e.target.value)}>
              <option value="">— Без папки —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon || '📁'} {c.name}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleSave}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
      <div className="items-grid">
        {notes.length === 0 && (
          <div className="empty-state"><div className="empty-icon">📝</div><p>Нет заметок. Создайте первую!</p></div>
        )}
        {notes.map((note) => (
          <div key={note.id} className="item-card" onClick={() => openEdit(note)}>
            <div className="item-card-header">
              <span className="item-type-icon">📝</span>
              <span className="item-title">{note.title}</span>
              <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}>✕</button>
            </div>
            <p className="item-preview">{(note.raw_text || '').slice(0, 120)}{(note.raw_text || '').length > 120 ? '…' : ''}</p>
            {note.ai_summary && <p className="item-summary">🤖 {note.ai_summary.slice(0, 100)}…</p>}
            <div className="item-footer">
              <span className="item-date">{formatDate(note.created_at)}</span>
              <div className="item-tags">{(note.tags || []).slice(0, 3).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MediaView: React.FC<{
  selectedCategory: string | null;
  categories: Category[];
  jobs: ProcessingJobUI[];
  onJobAdd: (job: ProcessingJobUI) => void;
  onJobComplete: (mediaId: string) => void;
}> = ({ selectedCategory, jobs, onJobAdd, onJobComplete }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const load = useCallback(() => {
    api.getMedia({ category_id: selectedCategory || undefined }).then(setItems).catch(() => {});
  }, [selectedCategory]);

  useEffect(() => { load(); }, [load]);

  const trackJob = (jobId: string, mediaId: string, title: string) => {
    const job: ProcessingJobUI = { id: jobId, mediaId, status: 'pending', progress: 0, title };
    onJobAdd(job);
    api.pollJobStatus(mediaId, (s) => onJobAdd({ ...job, status: s.status, progress: s.progress_percent }))
      .then(() => { onJobComplete(mediaId); load(); })
      .catch(() => {});
  };

  const handleUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlInput('');
    try {
      const res = await api.processUrl(url);
      trackJob(res.job_id, res.media_id, url.slice(0, 50));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Ошибка'); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.uploadFile(file, file.name);
      trackJob(res.job_id, res.media_id, file.name);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Ошибка загрузки'); }
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        try {
          const res = await api.uploadFile(file, 'Голосовая заметка');
          trackJob(res.job_id, res.media_id, 'Голосовая заметка');
        } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Ошибка'); }
      };
      recorder.start();
      setIsRecording(true);
    } catch { alert('Нет доступа к микрофону'); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить?')) return;
    await api.deleteMedia(id).catch(() => {}); load();
  };

  return (
    <div className="content-view">
      <div className="view-header"><h2>Медиа</h2></div>
      <div className="add-bar">
        <input
          className="form-input flex-1"
          placeholder="Вставьте URL (YouTube, подкаст, статья)..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
        />
        <button className="btn-primary" onClick={handleUrl}>Добавить</button>
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>📎 Файл</button>
        <button className={`btn-ghost${isRecording ? ' recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? '⏹ Стоп' : '🎙️ Запись'}
        </button>
        <input ref={fileRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={handleUpload} />
      </div>
      {jobs.length > 0 && (
        <div className="jobs-list">
          {jobs.map((job) => (
            <div key={job.id} className="job-item">
              <span className="job-title">{job.title.slice(0, 50)}</span>
              <span className="job-status">{job.status}</span>
              <div className="job-progress"><div className="job-progress-bar" style={{ width: `${job.progress}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>{typeIcon(selectedItem.type)}</span>
              <h3>{selectedItem.title}</h3>
              <button className="icon-btn" onClick={() => setSelectedItem(null)}>✕</button>
            </div>
            {selectedItem.source_url && <a className="item-link" href={selectedItem.source_url} target="_blank" rel="noreferrer">{selectedItem.source_url}</a>}
            {selectedItem.ai_summary && <div className="detail-section"><strong>AI-резюме</strong><p>{selectedItem.ai_summary}</p></div>}
            {selectedItem.raw_text && <div className="detail-section"><strong>Транскрипция / текст</strong><pre className="detail-text">{selectedItem.raw_text.slice(0, 3000)}</pre></div>}
            <div className="item-tags">{(selectedItem.tags || []).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
          </div>
        </div>
      )}
      <div className="items-grid">
        {items.length === 0 && (
          <div className="empty-state"><div className="empty-icon">📦</div><p>Нет медиа. Добавьте URL или загрузите файл.</p></div>
        )}
        {items.map((item) => (
          <div key={item.id} className="item-card" onClick={() => setSelectedItem(item)}>
            <div className="item-card-header">
              <span className="item-type-icon">{typeIcon(item.type)}</span>
              <span className="item-title">{item.title}</span>
              <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>✕</button>
            </div>
            {item.ai_summary && <p className="item-summary">🤖 {item.ai_summary.slice(0, 100)}…</p>}
            <div className="item-footer">
              <span className="item-date">{formatDate(item.created_at)}</span>
              {item.duration > 0 && <span className="item-duration">{formatDuration(item.duration)}</span>}
              <span className={`item-status status-${item.status}`}>{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try { setResults(await api.search(query, 15, 0.4)); }
    catch { setResults([]); }
    finally { setLoading(false); }
  };

  return (
    <div className="content-view">
      <div className="view-header"><h2>Семантический поиск</h2></div>
      <div className="add-bar">
        <input
          className="form-input flex-1"
          placeholder="Поиск по смыслу..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn-primary" onClick={handleSearch} disabled={loading}>{loading ? '…' : 'Найти'}</button>
      </div>
      <div className="search-results">
        {results.length === 0 && !loading && query && <div className="empty-state"><p>Ничего не найдено.</p></div>}
        {results.map((r) => (
          <div key={r.id} className="search-result-card">
            <div className="result-header">
              <span className="item-type-icon">{typeIcon(r.type || 'web')}</span>
              <span className="item-title">{r.title}</span>
              <span className="similarity-badge">{Math.round(r.similarity * 100)}%</span>
            </div>
            <p className="item-summary">{r.ai_summary}</p>
            <div className="item-tags">{(r.tags || []).map((t) => <span key={t} className="tag">#{t}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState('#6366f1');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.createCategory({ name, icon, color }).catch(() => {});
    onCreated(); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Новая папка</h3>
        <div className="form-row">
          <input className="form-input icon-input" placeholder="📁" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          <input className="form-input flex-1" placeholder="Название папки" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <input type="color" className="color-picker" value={color} onChange={(e) => setColor(e.target.value)} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={handleCreate}>Создать</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [jobs, setJobs] = useState<ProcessingJobUI[]>([]);

  const loadCategories = useCallback(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleJobAdd = (job: ProcessingJobUI) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = job; return u; }
      return [...prev, job];
    });
  };

  const handleJobComplete = (mediaId: string) => {
    setJobs((prev) => prev.filter((j) => j.mediaId !== mediaId));
  };

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategorySelect={setSelectedCategory}
        onCreateCategory={() => setShowCatModal(true)}
      />
      <main className="main-content">
        {activeView === 'chat' && <ChatView />}
        {activeView === 'notes' && <NotesView selectedCategory={selectedCategory} categories={categories} />}
        {activeView === 'media' && (
          <MediaView
            selectedCategory={selectedCategory}
            categories={categories}
            jobs={jobs}
            onJobAdd={handleJobAdd}
            onJobComplete={handleJobComplete}
          />
        )}
        {activeView === 'search' && <SearchView />}
        {activeView === 'feeds' && (
          <div className="content-view">
            <div className="view-header"><h2>Фиды и подписки</h2></div>
            <FeedView onMediaAdded={() => {}} />
          </div>
        )}
      </main>
      {showCatModal && <CategoryModal onClose={() => setShowCatModal(false)} onCreated={loadCategories} />}
    </div>
  );
};

export default App;
