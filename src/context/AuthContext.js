import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase, createIsolatedClient } from '../lib/supabase';
import { storage } from '../lib/storage';
import { DEFAULT_LOCAL_USERS } from '../data/seed';
import { getProfiles, saveProfile } from '../data/api';
import { seedIfEmpty, putLocal, selectById } from '../data/store';

const LOCAL_SESSION_KEY = 'tq:local-session';

const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadRemoteProfile = useCallback(async session => {
    if (!session?.user) return null;
    const cached = selectById('profiles', session.user.id);
    let profile = cached;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (data) profile = data;
    } catch {
      /* offline: fall back to the cached profile */
    }
    if (!profile) {
      // First login for an invited account: create a default employee profile.
      profile = {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || session.user.email,
        role: 'employee',
        active: true,
      };
      saveProfile(profile);
    } else {
      putLocal('profiles', profile);
    }
    return { ...profile, email: profile.email || session.user.email };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!isSupabaseConfigured) {
        seedIfEmpty('profiles', DEFAULT_LOCAL_USERS);
        const savedId = await storage.getItem(LOCAL_SESSION_KEY);
        const profile = savedId ? selectById('profiles', savedId) : null;
        if (mounted) {
          setUser(profile && profile.active !== false ? profile : null);
          setInitializing(false);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      const profile = await loadRemoteProfile(data?.session);
      if (mounted) {
        setUser(profile);
        setInitializing(false);
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session) {
          setUser(null);
          return;
        }
        const nextProfile = await loadRemoteProfile(session);
        setUser(nextProfile);
      });
    }

    boot();
    return () => {
      mounted = false;
    };
  }, [loadRemoteProfile]);

  const signIn = useCallback(
    async (identifier, secret) => {
      setAuthError(null);
      if (!isSupabaseConfigured) {
        const profile = getProfiles().find(
          item => String(item.email).toLowerCase() === String(identifier).trim().toLowerCase()
        );
        if (!profile || profile.active === false || String(profile.pin) !== String(secret).trim()) {
          const message = 'Unknown account or wrong PIN.';
          setAuthError(message);
          throw new Error(message);
        }
        await storage.setItem(LOCAL_SESSION_KEY, profile.id);
        setUser(profile);
        return profile;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(identifier).trim(),
        password: secret,
      });
      if (error) {
        setAuthError(error.message);
        throw error;
      }
      const profile = await loadRemoteProfile(data.session);
      if (profile?.active === false) {
        await supabase.auth.signOut();
        const message = 'This account has been deactivated.';
        setAuthError(message);
        throw new Error(message);
      }
      setUser(profile);
      return profile;
    },
    [loadRemoteProfile]
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      await storage.removeItem(LOCAL_SESSION_KEY);
    }
    setUser(null);
  }, []);

  /** Admin-only: registers a new login without touching the current session. */
  const createUser = useCallback(async ({ email, password, full_name }) => {
    if (!isSupabaseConfigured) throw new Error('Cloud accounts require Supabase to be configured.');
    const client = createIsolatedClient();
    const { data, error } = await client.auth.signUp({
      email: String(email).trim(),
      password,
      options: { data: { full_name } },
    });
    if (error) throw error;
    if (!data?.user) throw new Error('Sign-up returned no user. Enable email sign-ups in Supabase.');
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists.');
    }
    return { user: data.user, needsConfirmation: !data.session };
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      authError,
      signIn,
      signOut,
      createUser,
      isAdmin: user?.role === 'admin',
      localMode: !isSupabaseConfigured,
    }),
    [user, initializing, authError, signIn, signOut, createUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
