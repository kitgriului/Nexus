import {
  Category,
  MediaItem,
  ChatMessage,
  JobStatus,
  SearchResult,
  Subscription,
} from '../types';

const API_BASE_URL = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export async function createCategory(payload: {
  name: string; description?: string; color?: string; icon?: string; parent_id?: string;
}): Promise<Category> {
  return apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateCategory(id: string, payload: Partial<{ name: string; description: string; color: string; icon: string }>): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiFetch(`/categories/${id}`, { method: 'DELETE' });
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotes(params?: { skip?: number; limit?: number; category_id?: string }): Promise<MediaItem[]> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set('skip', String(params.skip));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.category_id) qs.set('category_id', params.category_id);
  return apiFetch<MediaItem[]>(`/notes${qs.toString() ? '?' + qs : ''}`);
}

export async function createNote(payload: { title: string; content: string; tags?: string[]; category_id?: string }): Promise<MediaItem> {
  return apiFetch<MediaItem>('/notes', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateNote(id: string, payload: Partial<{ title: string; content: string; tags: string[]; category_id: string }>): Promise<MediaItem> {
  return apiFetch<MediaItem>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteNote(id: string): Promise<void> {
  await apiFetch(`/notes/${id}`, { method: 'DELETE' });
}

// ── Media ─────────────────────────────────────────────────────────────────────

export async function getMedia(params?: { skip?: number; limit?: number; status?: string; category_id?: string; type?: string }): Promise<MediaItem[]> {
  const qs = new URLSearchParams();
  if (params?.skip !== undefined) qs.set('skip', String(params.skip));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.category_id) qs.set('category_id', params.category_id);
  if (params?.type) qs.set('type', params.type);
  return apiFetch<MediaItem[]>(`/media${qs.toString() ? '?' + qs : ''}`);
}

export async function getMediaById(id: string): Promise<MediaItem> {
  return apiFetch<MediaItem>(`/media/${id}`);
}

export async function deleteMedia(id: string): Promise<void> {
  await apiFetch(`/media/${id}`, { method: 'DELETE' });
}

export async function processUrl(url: string, title?: string): Promise<{ job_id: string; media_id: string; status: string }> {
  return apiFetch('/media/process/url', { method: 'POST', body: JSON.stringify({ url, title }) });
}

export async function uploadFile(file: File, title?: string): Promise<{ job_id: string; media_id: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  if (title) form.append('title', title);
  const res = await fetch(`${API_BASE_URL}/media/process/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function getJobStatus(mediaId: string): Promise<JobStatus> {
  return apiFetch<JobStatus>(`/media/${mediaId}/job`);
}

export async function pollJobStatus(mediaId: string, onProgress?: (s: JobStatus) => void, intervalMs = 2000): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getJobStatus(mediaId);
        onProgress?.(job);
        if (job.status === 'completed' || job.status === 'error') {
          clearInterval(timer);
          if (job.status === 'error') reject(new Error(job.error_message || 'Processing failed'));
          else resolve(await getMediaById(mediaId));
        }
      } catch (err) { clearInterval(timer); reject(err); }
    };
    const timer = setInterval(poll, intervalMs);
    poll();
  });
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function search(query: string, limit = 10, minSimilarity = 0.5): Promise<SearchResult[]> {
  return apiFetch<SearchResult[]>('/search', { method: 'POST', body: JSON.stringify({ query, limit, min_similarity: minSimilarity }) });
}

export async function searchByTag(tag: string): Promise<MediaItem[]> {
  return apiFetch<MediaItem[]>(`/search/tags/${encodeURIComponent(tag)}`);
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function chat(message: string, maxContextItems = 5): Promise<{ response: string; context_media_ids: string[] }> {
  return apiFetch('/chat', { method: 'POST', body: JSON.stringify({ message, max_context_items: maxContextItems }) });
}

export async function getChatHistory(skip = 0, limit = 50): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/history?skip=${skip}&limit=${limit}`);
}

export async function clearChatHistory(): Promise<void> {
  await apiFetch('/chat/history', { method: 'DELETE' });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<Subscription[]> {
  return apiFetch<Subscription[]>('/subscriptions');
}

export async function createSubscription(payload: { url: string; title: string; type?: string; description?: string; prompt?: string; period_days?: number }): Promise<Subscription> {
  return apiFetch<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateSubscription(id: string, update: Partial<{ title: string; description: string; sync_enabled: boolean; prompt: string; period_days: number }>): Promise<Subscription> {
  return apiFetch<Subscription>(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(update) });
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiFetch(`/subscriptions/${id}`, { method: 'DELETE' });
}

export async function syncSubscription(id: string): Promise<unknown> {
  return apiFetch(`/subscriptions/${id}/sync`, { method: 'POST' });
}

export type { Category, MediaItem, ChatMessage, JobStatus, SearchResult, Subscription };
