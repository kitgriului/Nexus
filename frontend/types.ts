// ── Core domain types ─────────────────────────────────────────────────────────

export type ContentType = 'note' | 'audio' | 'video' | 'youtube' | 'web' | 'podcast' | 'instagram';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent_id?: string;
  created_at: string;
  item_count: number;
}

export interface MediaItem {
  id: string;
  title: string;
  type: ContentType;
  source_type: string;
  source_url?: string;
  duration: number;
  raw_text?: string;
  ai_summary?: string;
  tags: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at?: string;
  origin: string;
  subscription_id?: string;
  category_id?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  context_media_ids?: string[];
  timestamp?: string;
}

export interface JobStatus {
  job_id: string;
  media_id: string;
  status: string;
  current_stage?: string;
  progress_percent: number;
  error_message?: string;
  celery_task_id?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  ai_summary: string;
  tags: string[];
  similarity: number;
  type?: ContentType;
}

export interface Subscription {
  id: string;
  url: string;
  title: string;
  type: string;
  description?: string;
  prompt?: string;
  period_days: number;
  last_checked?: string;
  sync_enabled: boolean;
  created_at: string;
}

// ── UI state types ────────────────────────────────────────────────────────────

export type ActiveView = 'chat' | 'notes' | 'media' | 'search' | 'feeds';

export interface ProcessingJobUI {
  id: string;
  mediaId: string;
  status: string;
  progress: number;
  title: string;
}
