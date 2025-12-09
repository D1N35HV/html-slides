interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface PresentationData {
  title: string;
  description?: string;
  slides: Array<{
    id: string;
    title?: string;
    elements: any[];
    backgroundColor?: string;
    backgroundImage?: string;
    transition?: string;
    order: number;
  }>;
  theme?: string;
  isPublic?: boolean;
  tags?: string[];
}

interface PresentationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string;
  sort?: string;
}

class ApiService {
  private baseURL: string;
  private authToken: string | null;

  constructor() {
    // Ensure base URL includes /api prefix expected by backend server
    const raw = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
    const normalized = String(raw).replace(/\/+$/, '');
    this.baseURL = normalized.endsWith('/api') ? normalized : normalized + '/api';
    this.authToken = localStorage.getItem('token');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Unexpected response (status ${response.status}): ${text.slice(0, 80)}`);
    }

    if (!response.ok) {
      // If unauthorized/forbidden, clear token and redirect to login
      if (response.status === 401 || response.status === 403) {
        try {
          this.clearAuthToken();
          // Avoid redirect loop if already on auth pages
          const path = window.location.pathname;
          if (path !== '/login' && path !== '/register') {
            window.location.href = '/login';
          }
        } catch (e) {
          // noop (likely running in non-browser env)
        }
      }
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    return data;
  }

  // Auth methods
  async register(userData: { name: string; email: string; password: string }): Promise<ApiResponse<{ user: any; token?: string }>> {
    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData),
    });

    const result = await this.handleResponse<{ user: any; token?: string }>(response);

    if (result.success && result.data?.token) {
      this.setAuthToken(result.data.token);
    }

    return result;
  }

  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: any; token?: string }>> {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(credentials),
    });

    const result = await this.handleResponse<{ user: any; token?: string }>(response);

    if (result.success && result.data?.token) {
      this.setAuthToken(result.data.token);
    }

    return result;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuthToken();
    }
  }

  async getProfile(): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/auth/me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Presentation methods
  async createPresentation(presentationData: PresentationData): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(presentationData),
    });

    return this.handleResponse(response);
  }

  async updatePresentation(id: string, presentationData: PresentationData): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(presentationData),
    });

    return this.handleResponse(response);
  }

  async getPresentation(id: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getUserPresentations(params: PresentationQueryParams = {}): Promise<ApiResponse> {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value !== undefined).map(([key, value]) => [key, String(value)])
    ).toString();

    const response = await fetch(`${this.baseURL}/presentations?${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPublicPresentations(params: PresentationQueryParams = {}): Promise<ApiResponse> {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value !== undefined).map(([key, value]) => [key, String(value)])
    ).toString();

    const response = await fetch(`${this.baseURL}/presentations/public?${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async deletePresentation(id: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async duplicatePresentation(id: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${id}/duplicate`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async addCollaborator(presentationId: string, email: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${presentationId}/collaborators`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email }),
    });

    return this.handleResponse(response);
  }

  async removeCollaborator(presentationId: string, collaboratorId: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/${presentationId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPresentationStats(): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/presentations/stats`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Health check
  async healthCheck(): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await fetch(`${this.baseURL.replace(/\/?api$/, '')}/health`, {
      method: 'GET',
    });

    return response.json();
  }

  // Upload methods
  async uploadFile(file: File): Promise<ApiResponse<{
    id: string;
    filename: string;
    originalName: string;
    type: 'image' | 'video';
    mimeType: string;
    size: number;
    url: string;
    userId: string;
    createdAt: string;
  }>> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseURL}/uploads`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse(response);
  }

  async getUploads(type?: 'image' | 'video'): Promise<ApiResponse<Array<{
    id: string;
    filename: string;
    type: 'image' | 'video';
    url: string;
    size: number;
    createdAt: string;
  }>>> {
    const queryString = type ? `?type=${type}` : '';
    const response = await fetch(`${this.baseURL}/uploads${queryString}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async deleteUpload(filename: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/uploads/${filename}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Template methods
  async uploadTemplate(file: File): Promise<ApiResponse<{
    id: string;
    name: string;
    originalFilename: string;
    slides: Array<{
      id: string;
      elements: any[];
      backgroundColor?: string;
      backgroundImage?: string;
    }>;
    slideCount: number;
    createdAt: string;
    thumbnails: string[];
    mediaFolder: string;
  }>> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseURL}/templates/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse(response);
  }

  /**
   * Upload template with streaming progress
   * Slides are received via socket.io events as they are parsed
   * The HTTP response returns the final complete template
   */
  async uploadTemplateStreaming(file: File): Promise<ApiResponse<{
    id: string;
    name: string;
    originalFilename: string;
    slides: Array<{
      id: string;
      elements: any[];
      backgroundColor?: string;
      backgroundImage?: string;
    }>;
    slideCount: number;
    createdAt: string;
    thumbnails: string[];
    mediaFolder: string;
  }>> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseURL}/templates/upload-stream`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse(response);
  }

  async getTemplates(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    originalFilename: string;
    slides: Array<{
      id: string;
      elements: any[];
      backgroundColor?: string;
      backgroundImage?: string;
    }>;
    slideCount: number;
    createdAt: string;
    thumbnails: string[];
    mediaFolder: string;
  }>>> {
    const response = await fetch(`${this.baseURL}/templates`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getTemplate(id: string): Promise<ApiResponse<{
    id: string;
    name: string;
    originalFilename: string;
    slides: Array<{
      id: string;
      elements: any[];
      backgroundColor?: string;
      backgroundImage?: string;
    }>;
    slideCount: number;
    createdAt: string;
    thumbnails: string[];
    mediaFolder: string;
  }>> {
    const response = await fetch(`${this.baseURL}/templates/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async getTemplateSlide(templateId: string, slideIndex: number): Promise<ApiResponse<{
    id: string;
    elements: any[];
    backgroundColor?: string;
    backgroundImage?: string;
  }>> {
    const response = await fetch(`${this.baseURL}/templates/${templateId}/slides/${slideIndex}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  async deleteTemplate(id: string): Promise<ApiResponse> {
    const response = await fetch(`${this.baseURL}/templates/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse(response);
  }

  // Auth token management
  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('token', token);
  }

  clearAuthToken(): void {
    this.authToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentPresentationId');
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  isAuthenticated(): boolean {
    return !!this.authToken;
  }

  // Get the server base URL (without /api) for media files
  getServerUrl(): string {
    return this.baseURL.replace(/\/api$/, '');
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Helper function to get the server URL for resolving media paths
export const getServerUrl = (): string => {
  const raw = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
  return String(raw).replace(/\/api$/, '').replace(/\/+$/, '');
};

export default apiService;
