/**
 * Authentication hook with tenant context
 * Manages JWT tokens and tenant-scoped API requests
 */

import { useState, useEffect, createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load token from localStorage on app start
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      try {
        const decoded = JSON.parse(atob(savedToken.split('.')[1]));
        if (decoded.exp > Date.now() / 1000) {
          setToken(savedToken);
          setUser({
            id: decoded.userId,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            tenantId: decoded.tenantId
          });
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.error('Invalid token:', error);
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Demo login - in production, call your auth service
    const mockToken = createMockJWT(email);
    
    setToken(mockToken);
    localStorage.setItem('auth_token', mockToken);
    
    const decoded = JSON.parse(atob(mockToken.split('.')[1]));
    setUser({
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      tenantId: decoded.tenantId
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  const hasRole = (role: string): boolean => {
    return user?.role === role || user?.role === 'admin';
  };

  const value: AuthContextType = {
    user,
    tenantId: user?.tenantId || null,
    token,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Demo JWT creation - replace with real auth service
function createMockJWT(email: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: 'user-123',
    email: email,
    name: email.split('@')[0],
    role: email.includes('admin') ? 'admin' : 'user',
    tenantId: 'tenant-demo',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  // In production, this would be properly signed
  return `${encodedHeader}.${encodedPayload}.demo-signature`;
}