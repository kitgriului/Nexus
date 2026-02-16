/**
 * WebSocket service for real-time job status updates
 */

export interface JobStatusUpdate {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  stage?: string;
  error?: string;
  result?: any;
}

type StatusCallback = (update: JobStatusUpdate) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, StatusCallback[]> = new Map();
  private reconnectTimeout: number = 1000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private url: string) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const update: JobStatusUpdate = JSON.parse(event.data);
          this.notifyCallbacks(update);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectTimeout}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectTimeout);

    this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, 30000);
  }

  subscribe(jobId: string, callback: StatusCallback) {
    if (!this.callbacks.has(jobId)) {
      this.callbacks.set(jobId, []);
    }
    this.callbacks.get(jobId)!.push(callback);

    // Request initial status
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', job_id: jobId }));
    }
  }

  unsubscribe(jobId: string, callback?: StatusCallback) {
    if (!callback) {
      this.callbacks.delete(jobId);
      return;
    }

    const callbacks = this.callbacks.get(jobId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.callbacks.delete(jobId);
      }
    }
  }

  private notifyCallbacks(update: JobStatusUpdate) {
    const callbacks = this.callbacks.get(update.job_id);
    if (callbacks) {
      callbacks.forEach(callback => callback(update));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.clear();
  }
}

// Singleton instance
const wsService = new WebSocketService(
  import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
);

export default wsService;
