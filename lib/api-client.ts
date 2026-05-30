import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: await this.getHeaders(),
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const result = await response.json();

      return {
        data: result,
        status: response.status,
        error: response.ok ? undefined : result.detail || 'Request failed',
      };
    } catch (error) {
      return {
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request('GET', endpoint);
  }

  post<T>(endpoint: string, data: any, useFormData: boolean = false): Promise<ApiResponse<T>> {
    if (useFormData) {
      return this.requestFormData('POST', endpoint, data);
    }
    return this.request('POST', endpoint, data);
  }

  async requestFormData<T>(
    method: string,
    endpoint: string,
    data?: any,
    isRawFormData: boolean = false
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const options: RequestInit = {
        method,
        headers,
        body: bodyData,
      };

      const response = await fetch(url, options);
      const result = await response.json();

      return {
        data: result,
        status: response.status,
        error: response.ok ? undefined : result.detail || 'Request failed',
      };
    } catch (error) {
      return {
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    return apiClient.requestFormData<{ message: string, memories: any[] }>('POST', '/api/memory/upload', formData, true);
  },

  list: (skip: number = 0, limit: number = 10) =>
    apiClient.get(`/api/memory/list?skip=${skip}&limit=${limit}`),

  get: (id: number) => apiClient.get(`/api/memory/${id}`),

  update: (id: number, content: string, title?: string, metadata?: any) =>
    apiClient.put(`/api/memory/${id}`, { content, title, metadata }),

  delete: (id: number) => apiClient.delete(`/api/memory/${id}`),
};

// Query endpoints
export const queryApi = {
  ask: (query: string, useMemory: boolean = true, sessionId?: string) =>
    apiClient.post('/api/query/ask', { query, use_memory: useMemory, session_id: sessionId }),

  sessions: () => apiClient.get('/api/query/sessions'),

  deleteSession: (sessionId: string) => apiClient.delete(`/api/query/sessions/${sessionId}`),

  history: (skip: number = 0, limit: number = 10, sessionId?: string) =>
    apiClient.get(`/api/query/history?skip=${skip}&limit=${limit}${sessionId ? `&session_id=${sessionId}` : ''}`),

  getInteraction: (id: number) => apiClient.get(`/api/query/${id}`),
};
