import React, { useState, useEffect } from 'react';
import * as api from '../apiClient/client';

interface Subscription {
  id: string;
  url: string;
  title: string;
  type: string;
  description?: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());

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
        type: 'site'
      });

      setSubscriptions((prev) => [...prev, subscription]);
      setNewUrl('');
      setNewTitle('');
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: sub.sync_enabled ? 1 : 0.6,
                }}
              >
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
                  {sub.last_checked && (
                    <div style={{
                      fontSize: '11px',
                      color: '#999',
                      marginTop: '2px',
                    }}>
                      Last checked: {new Date(sub.last_checked * 1000).toLocaleDateString()}
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
                    onClick={() => handleToggleSync(sub)}
                    title={sub.sync_enabled ? 'Disable' : 'Enable'}
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
                    {sub.sync_enabled ? '✓' : '○'}
                  </button>

                  <button
                    onClick={() => handleSyncSubscription(sub.id)}
                    disabled={syncing.has(sub.id) || !sub.sync_enabled}
                    title="Sync now"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #ddd',
                      background: syncing.has(sub.id) ? '#f0f0f0' : 'white',
                      cursor: syncing.has(sub.id) || !sub.sync_enabled ? 'not-allowed' : 'pointer',
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
