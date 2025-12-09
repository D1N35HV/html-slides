import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/ApiService';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    defaultTemplate: string;
    autoSave: boolean;
    notifications: boolean;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = apiService.getAuthToken();
      
      if (!token) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const response = await apiService.getProfile();
        
        if (response.success && response.data) {
          setAuthState({
            user: response.data as User,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } else {
          // Invalid token, clear it
          apiService.clearAuthToken();
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        apiService.clearAuthToken();
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        });
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiService.login({ email, password });
      
      if (response.success && response.data) {
        setAuthState({
          user: response.data.user as User,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response.message || 'Login failed'
        }));
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      return false;
    }
  }, []);

  // Register function
  const register = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiService.register({ name, email, password });
      
      if (response.success && response.data) {
        setAuthState({
          user: response.data.user as User,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: response.message || 'Registration failed'
        }));
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...authState,
    login,
    register,
    logout,
    clearError
  };
}
