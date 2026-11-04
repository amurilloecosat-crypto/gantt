import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import OnboardingOverlay from './OnboardingOverlay.jsx';

const OnboardingContext = createContext({ active: false, startTour() {}, maybeAutoStart() {} });

export function OnboardingProvider({ children }) {
  const { user, markOnboardingDone } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const autoStartedRef = useRef(false);

  // Si se cierra la sesión a medias, el recorrido se descarta.
  useEffect(() => {
    if (!user) setActive(false);
  }, [user]);

  const startTour = useCallback(() => {
    setIndex(0);
    setActive(true);
    navigate('/');
  }, [navigate]);

  const close = useCallback(() => {
    setActive(false);
    markOnboardingDone();
  }, [markOnboardingDone]);

  // Lo llama el dashboard al cargar: solo arranca solo para cuentas nuevas (sin proyectos y sin haber visto el tutorial).
  const maybeAutoStart = useCallback(
    (projectCount) => {
      if (!user || user.onboardingDone || autoStartedRef.current) return;
      autoStartedRef.current = true;
      if (projectCount > 0) {
        markOnboardingDone();
        return;
      }
      startTour();
    },
    [user, markOnboardingDone, startTour]
  );

  const value = useMemo(() => ({ active, startTour, maybeAutoStart }), [active, startTour, maybeAutoStart]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {active && user && <OnboardingOverlay index={index} onNext={() => setIndex((i) => i + 1)} onFinish={close} onSkip={close} />}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
