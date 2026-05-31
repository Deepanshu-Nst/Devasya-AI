import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
// Render free tier cold starts take 30-60s, so timeouts must be generous
const DEFAULT_TIMEOUT_MS = 30000;  // 30s for normal requests
const UPLOAD_TIMEOUT_MS = 120000; // 120s for file uploads (cold start + extraction + embedding)

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      console.warn("Failed to get Supabase session for headers", e);
    }

    return headers;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeout/1000)}s. The server may be waking up — please try again.`);
      }
      throw error;
    }
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: await this.getHeaders(),
        cache: 'no-store', // Prevent browser/Next.js from caching list responses
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await this.fetchWithTimeout(url, options, timeoutMs);
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        result = { detail: response.statusText };
      }

      const errorDetail = result.detail || result.message || 'Request failed';
      const errorMessage = typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail);

      return {
        data: result,
        status: response.status,
        error: response.ok ? undefined : errorMessage,
      };
    } catch (error: any) {
      return {
        status: 0,
        error: error.message || 'Unknown network error',
      };
    }
  }

  get<T>(endpoint: string, timeoutMs?: number): Promise<ApiResponse<T>> {
    return this.request('GET', endpoint, undefined, timeoutMs);
  }

  post<T>(endpoint: string, data: any, useFormData: boolean = false, timeoutMs?: number): Promise<ApiResponse<T>> {
    if (useFormData) {
      return this.requestFormData('POST', endpoint, data, false, timeoutMs);
    }
    return this.request('POST', endpoint, data, timeoutMs);
  }

  async requestFormData<T>(
    method: string,
    endpoint: string,
    data?: any,
    isRawFormData: boolean = false,
    timeoutMs: number = UPLOAD_TIMEOUT_MS // 120s for uploads — handles Render cold start
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      let bodyData: any;

      if (isRawFormData) {
        bodyData = data;
      } else {
        bodyData = new FormData();
        if (data) {
          Object.keys(data).forEach(key => {
            bodyData.append(key, data[key]);
          });
        }
      }

      const headers: Record<string, string> = {};
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (e) {
        console.warn("Failed to get session for FormData headers", e);
      }

      const options: RequestInit = {
        method,
        headers,
        body: bodyData,
      };

      const response = await this.fetchWithTimeout(url, options, timeoutMs);
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        result = { detail: response.statusText };
      }

      return {
        data: result,
        status: response.status,
        error: response.ok ? undefined : result.detail || 'Upload failed',
      };
    } catch (error: any) {
      return {
        status: 0,
        error: error.message || 'Unknown network error during upload',
      };
    }
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request('DELETE', endpoint);
  }

  put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request('PUT', endpoint, data);
  }
}

export const apiClient = new ApiClient();

// Auth endpoints
export const authApi = {
  getMe: () => apiClient.get('/api/auth/me'),
};

// Memory endpoints
export const memoryApi = {
  add: (content: string, title?: string, metadata?: any) =>
    apiClient.post('/api/memory/add', { content, title, metadata }),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.requestFormData<{ message: string, document_id: string }>('POST', '/api/memory/upload', formData, true);
  },

  list: (skip: number = 0, limit: number = 10) =>
    apiClient.get(`/api/memory/list?skip=${skip}&limit=${limit}`),

  get: (id: string) => apiClient.get(`/api/memory/${id}`),

  update: (id: string, content: string, title?: string, visibility?: string) =>
    apiClient.put(`/api/memory/${id}`, { content, title, visibility }),

  delete: (id: string) => apiClient.delete(`/api/memory/${id}`),
};

// Blocks endpoints
export const blocksApi = {
  getPages: () => apiClient.get('/api/blocks/pages'),
  getBlock: (id: string) => apiClient.get(`/api/blocks/${id}`),
  getChildren: (id: string) => apiClient.get(`/api/blocks/${id}/children`),
  create: (data: any) => apiClient.post('/api/blocks/', data),
  update: (id: string, data: any) => apiClient.put(`/api/blocks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/blocks/${id}`),
  batch: (operations: any[]) => apiClient.post('/api/blocks/batch', operations),
  query: (queryParams: any) => apiClient.post('/api/blocks/query', queryParams)
};

export const tasksApi = {
  query: (workspaceId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspace_id', workspaceId);
    if (status) params.append('status', status);
    const queryString = params.toString();
    return apiClient.get(`/api/tasks${queryString ? `?${queryString}` : ''}`);
  },
  create: (data: any) => apiClient.post('/api/tasks', data),
  update: (id: string, data: any) => apiClient.request('PATCH', `/api/tasks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/tasks/${id}`),
};

// Query endpoints
export const queryApi = {
  ask: (query: string, useMemory: boolean = true, sessionId?: string) =>
    apiClient.post('/api/query/ask', { query, use_memory: useMemory, session_id: sessionId }, false, 60000), // 60s timeout for reasoning

  sessions: () => apiClient.get('/api/query/sessions'),

  deleteSession: (sessionId: string) => apiClient.delete(`/api/query/sessions/${sessionId}`),

  history: (skip: number = 0, limit: number = 50, sessionId?: string) =>
    apiClient.get(`/api/query/history?skip=${skip}&limit=${limit}${sessionId ? `&session_id=${sessionId}` : ''}`),

  getInteraction: (id: string) => apiClient.get(`/api/query/${id}`),
};

export const aiApi = {
  inlineGenerate: async (
    data: { action: string; prompt?: string; context_blocks?: string[]; current_page_id?: string },
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) throw new Error("No authentication token");
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${baseUrl}/api/ai/inline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
      signal
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    if (!response.body) throw new Error("No response body");
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) onChunk(parsed.text);
          } catch (e) {
            // ignore partial JSON parse errors for now
          }
        }
      }
    }
  }
};
