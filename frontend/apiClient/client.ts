/**
 * API client for Nexus backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ProcessUrlResponse {
  job_id: string;
  media_id: string;
  status: string;
  celery_task_id: string;
}

export interface ProcessUploadResponse {
  job_id: string;
  media_id: string;
  status: string;
  celery_task_id: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: string;
  source_type: string;
  source_url?: string;
  duration?: number;
  raw_text?: string;
  transcript?: string;
  ai_summary?: string;
  tags?: string[];
  status: string;
  created_at: string;
  imported_at?: string;
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
}

export interface ChatResponse {
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    excerpt: string;
    score: number;
  }>;
}

/**
 * Process media from URL
 */
export async function processUrl(url: string, title?: string): Promise<ProcessUrlResponse> {
  const response = await fetch(`${API_BASE_URL}/media/process/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to process URL: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Upload and process audio file
 */
export async function processUpload(file: File, title?: string): Promise<ProcessUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  
  const response = await fetch(`${API_BASE_URL}/media/process/upload`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get all media items
 */
export async function getMedia(skip = 0, limit = 50, status?: string): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });
  if (status) params.append('status', status);
  
  const response = await fetch(`${API_BASE_URL}/media?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get single media item
 */
export async function getMediaById(id: string): Promise<MediaItem> {
  const response = await fetch(`${API_BASE_URL}/media/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete media item
 */
export async function deleteMedia(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/media/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete media: ${response.statusText}`);
  }
}

/**
 * Get job status
 */
export async function getJobStatus(mediaId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE_URL}/media/${mediaId}/job`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch job status: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Semantic search
 */
export async function search(query: string, limit = 10, minSimilarity = 0.7): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit, min_similarity: minSimilarity })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to search: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Chat with archive
 */
export async function chat(request: { message: string, max_context_items?: number }): Promise<{ response: string; context_media_ids: string[] }> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to chat: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get chat history
 */
export async function getChatHistory(skip = 0, limit = 50) {
  const response = await fetch(`${API_BASE_URL}/chat/history?skip=${skip}&limit=${limit}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch chat history: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Poll job status until completion
 */
export async function pollJobStatus(
  mediaId: string, 
  onProgress?: (status: JobStatus) => void,
  intervalMs = 2000
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const jobStatus = await getJobStatus(mediaId);
        
        if (onProgress) {
          onProgress(jobStatus);
        }
        
        // Check if completed
        if (jobStatus.status === 'completed' || jobStatus.status === 'error') {
          clearInterval(pollInterval);
          
          if (jobStatus.status === 'error') {
            reject(new Error(jobStatus.error_message || 'Processing failed'));
          } else {
            // Fetch final media item
            const media = await getMediaById(mediaId);
            resolve(media);
          }
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    };
    
    const pollInterval = setInterval(poll, intervalMs);
    poll(); // Start immediately
  });
}
