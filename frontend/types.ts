
export type MediaType = 'audio' | 'video' | 'youtube' | 'instagram' | 'web_source' | 'chat_session';
export type TranscriptSource = 'whisper' | 'youtube_captions' | 'gemini' | 'none';
export type SourceType = 'mic_audio' | 'uploaded_audio' | 'youtube_url' | 'link';

export interface SpeakerTurn {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export type MediaStatus = 'pending' | 'processing' | 'completed' | 'error' | 'deferred_summary';

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  sourceType: SourceType;
  transcriptSource: TranscriptSource;
  sourceUrl: string; 
  duration: number;
  rawText?: string; // Полный неразмеченный текст
  transcription?: SpeakerTurn[];
  transcriptHash?: string;
  createdAt: number;
  importedAt: number;
  aiSummary?: string;
  status: MediaStatus;
  origin: 'manual' | 'subscription';
  subscriptionId?: string;
  tags: string[];
}

export interface Subscription {
  id: string;
  url: string;
  title: string;
  lastChecked: string | null;
  type: 'channel' | 'site';
  description?: string;
  prompt?: string;
  periodDays?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface Activity {
  id: string;
  entityId: string;
  entityType: 'media' | 'chat';
  action: 'create' | 'sync' | 'chat';
  description: string;
  timestamp: number;
}
