import { PropsWithChildren, useEffect, useState } from 'react';
import { FastApiAdapter } from '@/auth/adapters/fastapi-adapter';
import { AuthContext } from '@/auth/context/auth-context';
import * as authHelper from '@/auth/lib/helpers';
import { AuthModel, UserModel } from '@/auth/lib/models';

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<AuthModel | undefined>(authHelper.getAuth());
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(currentUser?.is_admin === true);
  }, [currentUser]);

  const saveAuth = (next: AuthModel | undefined) => {
    setAuth(next);
    if (next) {
      authHelper.setAuth(next);
    } else {
      authHelper.removeAuth();
    }
  };

  const getUser = async () => FastApiAdapter.getCurrentUser();

  const verify = async () => {
    if (!auth?.access_token) return;
    try {
      const user = await getUser();
      if (user) {
        setCurrentUser(user);
      } else {
        saveAuth(undefined);
        setCurrentUser(undefined);
      }
    } catch {
      saveAuth(undefined);
      setCurrentUser(undefined);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const next = await FastApiAdapter.login(username, password);
      saveAuth(next);
      const user = await getUser();
      setCurrentUser(user || undefined);
    } catch (err) {
      saveAuth(undefined);
      throw err;
    }
  };

  const notImplemented = (feature: string) => {
    throw new Error(`${feature} is not enabled in this environment.`);
  };

  const register = async () => {
    notImplemented('Registration');
  };

  const requestPasswordReset = async () => {
    notImplemented('Password reset request');
  };

  const resetPassword = async () => {
    notImplemented('Password reset');
  };

  const resendVerificationEmail = async () => {
    notImplemented('Email verification resend');
  };

  const updateProfile = async () => {
    notImplemented('Profile update');
    return {} as UserModel;
  };

  const logout = () => {
    void FastApiAdapter.logout();
    saveAuth(undefined);
    setCurrentUser(undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        setLoading,
        auth,
        saveAuth,
        user: currentUser,
        setUser: setCurrentUser,
        login,
        register,
        requestPasswordReset,
        resetPassword,
        resendVerificationEmail,
        getUser,
        updateProfile,
        logout,
        verify,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
