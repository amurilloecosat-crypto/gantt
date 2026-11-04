import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { tr } from './lang.js';

const AuthContext = createContext(null);

const onboardingKey = (id) => `ariadna.onboarding.done.${id}`;

function readLocalOnboardingDone(id) {
  try {
    return window.localStorage.getItem(onboardingKey(id)) === '1';
  } catch (err) {
    return false;
  }
}

function toPublicUser(supabaseUser) {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.name || supabaseUser.email,
    onboardingDone: !!supabaseUser.user_metadata?.onboarding_done || readLocalOnboardingDone(supabaseUser.id),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(toPublicUser(session?.user));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toPublicUser(session?.user));
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    return { needsEmailConfirmation: !data.session };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Marca el tutorial como visto: primero en este navegador (inmediato) y luego en la cuenta, para que no reaparezca en otro equipo.
  const markOnboardingDone = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev;
      try {
        window.localStorage.setItem(onboardingKey(prev.id), '1');
      } catch (err) {
        // Sin almacenamiento: queda solo en la cuenta.
      }
      return { ...prev, onboardingDone: true };
    });
    try {
      await supabase.auth.updateUser({ data: { onboarding_done: true } });
    } catch (err) {
      // Si falla, el aviso local evita que reaparezca en este navegador.
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, markOnboardingDone }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error(tr('useAuth debe usarse dentro de AuthProvider', 'useAuth must be used within AuthProvider'));
  return ctx;
}
