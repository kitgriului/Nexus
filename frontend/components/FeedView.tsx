import React, { useState, useEffect } from 'react';
import * as api from '../apiClient/client';

interface Subscription {
  id: string;
  url: string;
  title: string;
  type: string;
  description?: string;
  prompt?: string;
  period_days?: number;
  last_checked?: number;
  sync_enabled: boolean;
  created_at: number;
}

interface FeedViewProps {
  onMediaAdded?: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({ onMediaAdded }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [periodPreset, setPeriodPreset] = useState('7');
  const [customDays, setCustomDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editPeriod, setEditPeriod] = useState('7');

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setError(null);
      const subs = await api.getSubscriptions();
      setSubscriptions(subs || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions');
    }
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddSubscription = async () => {
    if (!newUrl.trim() || !newTitle.trim()) {
      setError('URL and title are required');
      return;
    }

    const periodDays = periodPreset === 'custom'
      ? Number(customDays)
      : Number(periodPreset);

    if (!periodDays || periodDays < 1 || periodDays > 365) {
      setError('Period must be between 1 and 365 days');
      return;
    }

    if (!validateUrl(newUrl)) {
      setError('Invalid URL');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const subscription = await api.createSubscription({
        url: newUrl.trim(),
        title: newTitle.trim(),
        type: 'site',
        prompt: newPrompt.trim() || undefined,
        period_days: periodDays
      });

      setSubscriptions((prev) => [...prev, subscription]);
      setNewUrl('');
      setNewTitle('');
      setNewPrompt('');
      setPeriodPreset('7');
      setCustomDays('');
    } catch (err: any) {
      const message = err.message || 'Failed to add subscription';
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!window.confirm('Delete this subscription?')) return;

    try {
      setError(null);
      await api.deleteSubscription(id);
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== id));
    } catch (err) {
      setError('Failed to delete subscription');
      console.error(err);
    }
  };

  const handleSyncSubscription = async (id: string) => {
    try {
      setError(null);
      setSyncing((prev) => new Set([...prev, id]));

      const result = await api.syncSubscription(id);
      
      // Poll for job completion
      if (result.celery_task_id) {
        // Let the main app handle job polling
        onMediaAdded?.();
      }

      // Refresh subscriptions
      await loadSubscriptions();
    } catch (err) {
      setError('Failed to sync subscription');
      console.error(err);
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggleSync = async (subscription: Subscription) => {
    try {
      setError(null);
      const updated = await api.updateSubscription(subscription.id, {
        sync_enabled: !subscription.sync_enabled
      });
      
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === subscription.id ? updated : sub))
      );
    } catch (err) {
      setError('Failed to update subscription');
      console.error(err);
    }
  };

  const handleStartEdit = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditPrompt(subscription.prompt || '');
    setEditPeriod(String(subscription.period_days || 7));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrompt('');
    setEditPeriod('7');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      setError(null);
      const periodDays = Number(editPeriod);
      
      if (!periodDays || periodDays < 1 || periodDays > 365) {
        setError('Period must be between 1 and 365 days');
        return;
      }

      const updated = await api.updateSubscription(id, {
        prompt: editPrompt.trim() || undefined,
        period_days: periodDays
      });
      
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === id ? updated : sub))
      );
      handleCancelEdit();
    } catch (err) {
      setError('Failed to update subscription');
      console.error(err);
    }
  };

  return (
    <div className="feed-view">
      {/* Add Subscription Form */}
      <div className="subscription-form" style={{
        background: '#fafafa',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
          Add Feed
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="url"
            placeholder="https://example.com or RSS feed URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            disabled={loading}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
          
          <input
            type="text"
            placeholder="Feed title (e.g., TechNews, MyBlog)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={loading}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />

          <textarea
            placeholder="What to extract? Example: 'новости про искусственный интеллект и GPT модели' or 'product launches and new features'"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            disabled={loading}
            rows={2}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '11px', color: '#666', marginTop: '-4px' }}>
            💡 AI will extract items matching your description. Leave empty to extract everything.
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value)}
              disabled={loading}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              <option value="1">Last 1 day</option>
              <option value="3">Last 3 days</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>

            {periodPreset === 'custom' && (
              <input
                type="number"
                min="1"
                max="365"
                placeholder="Days"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  width: '110px',
                }}
              />
            )}
          </div>
          
          <button
            onClick={handleAddSubscription}
            disabled={loading}
            style={{
              padding: '8px 12px',
              background: loading ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            {loading ? 'Adding...' : 'Add Feed'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '12px',
          color: '#c53030',
          fontSize: '13px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Subscriptions List */}
      <div className="subscriptions-list">
        {subscriptions.length === 0 ? (
          <div className="empty-state" style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📰</div>
            <div>No feeds yet. Add one to get started!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  padding: '12px',
                  background: sub.sync_enabled ? '#fff' : '#f5f5f5',
                  opacity: sub.sync_enabled ? 1 : 0.6,
                }}
              >
                {editingId === sub.id ? (
                  // Edit mode
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: '500', fontSize: '13px' }}>{sub.title}</div>
                    <textarea
                      placeholder="What to extract?"
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={2}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="Days"
                      value={editPeriod}
                      onChange={(e) => setEditPeriod(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        width: '100px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleSaveEdit(sub.id)}
                        style={{
                          padding: '4px 12px',
                          fontSize: '11px',
                          border: '1px solid #0066cc',
                          background: '#0066cc',
                          color: 'white',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: '4px 12px',
                          fontSize: '11px',
                          border: '1px solid #ddd',
                          background: 'white',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '500',
                        fontSize: '13px',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {sub.title}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#666',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {sub.url}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#777',
                        marginTop: '4px',
                      }}>
                        📅 Period: {sub.period_days || 7} days {sub.sync_enabled && '• 🔄 Auto-sync: daily'}
                      </div>
                      {sub.prompt && (
                        <div style={{
                          fontSize: '11px',
                          color: '#555',
                          marginTop: '2px',
                          fontStyle: 'italic',
                        }}>
                          🎯 "{sub.prompt}"
                        </div>
                      )}
                      {sub.last_checked && (
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          marginTop: '2px',
                        }}>
                          Last synced: {new Date(sub.last_checked * 1000).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      marginLeft: '8px',
                      flexShrink: 0,
                    }}>
                      <button
                        onClick={() => handleStartEdit(sub)}
                        title="Edit settings"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: '1px solid #ddd',
                          background: 'white',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleToggleSync(sub)}
                        title={sub.sync_enabled ? 'Disable auto-sync' : 'Enable auto-sync'}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: `1px solid ${sub.sync_enabled ? '#0066cc' : '#ccc'}`,
                          background: sub.sync_enabled ? '#0066cc' : 'white',
                          color: sub.sync_enabled ? 'white' : '#333',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        {sub.sync_enabled ? 'ON' : 'OFF'}
                      </button>

                      <button
                        onClick={() => handleSyncSubscription(sub.id)}
                        disabled={syncing.has(sub.id)}
                        title="Sync now"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: '1px solid #ddd',
                          background: syncing.has(sub.id) ? '#f0f0f0' : 'white',
                          cursor: syncing.has(sub.id) ? 'not-allowed' : 'pointer',
                          borderRadius: '3px',
                        }}
                      >
                        {syncing.has(sub.id) ? '⟳' : '🔄'}
                      </button>

                      <button
                        onClick={() => handleDeleteSubscription(sub.id)}
                        title="Delete"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          border: '1px solid #fcc',
                          background: 'white',
                          color: '#c53030',
                          borderRadius: '3px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
