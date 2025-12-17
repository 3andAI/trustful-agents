import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { SiweMessage } from 'siwe';
import { useWallet } from './useWallet';
import {
  getNonce,
  login,
  logout as apiLogout,
  getProfile,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  type Profile,
} from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: Profile | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId, signMessage, disconnect } = useWallet();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profileData = await getProfile();
        setProfile(profileData);
        setIsAuthenticated(true);
      } catch {
        clearAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // Handle wallet disconnection
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      clearAuthToken();
      setIsAuthenticated(false);
      setProfile(null);
    }
  }, [isConnected, isAuthenticated]);

  const handleLogin = useCallback(async () => {
    if (!address || !chainId) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get nonce from server
      const nonce = await getNonce();

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Trustful Agents Governance Dashboard',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      });

      const messageString = message.prepareMessage();

      // Sign the message
      const signature = await signMessage(messageString);

      // Send to server for verification
      const { token } = await login(messageString, signature);
      setAuthToken(token);

      // Fetch profile
      const profileData = await getProfile();
      setProfile(profileData);
      setIsAuthenticated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, signMessage]);

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors
    } finally {
      clearAuthToken();
      setIsAuthenticated(false);
      setProfile(null);
      disconnect();
    }
  }, [disconnect]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        profile,
        error,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
