import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { colors, fonts } from '../theme.js';
import { buildSteps } from './onboardingSteps.js';

const PAD = 8;
const Z = 1000;
const DIM = 'rgba(8, 14, 12, 0.62)';
const MARGIN = 12;

function sameRect(a, b) {
  return !!a && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function placeCard(rect, card, vp, preferred) {
  if (!rect) return { top: Math.max(MARGIN, (vp.h - card.h) / 2), left: Math.max(MARGIN, (vp.w - card.w) / 2) };
  const gap = 14;
  const hole = { top: rect.top - PAD, left: rect.left - PAD, right: rect.left + rect.width + PAD, bottom: rect.top + rect.height + PAD };
  const centerLeft = clamp(rect.left + rect.width / 2 - card.w / 2, MARGIN, vp.w - card.w - MARGIN);
  const centerTop = clamp(rect.top + rect.height / 2 - card.h / 2, MARGIN, vp.h - card.h - MARGIN);
  const options = {
    bottom: { top: hole.bottom + gap, left: centerLeft },
    top: { top: hole.top - gap - card.h, left: centerLeft },
    right: { top: centerTop, left: hole.right + gap },
    left: { top: centerTop, left: hole.left - gap - card.w },
  };
  const order = [preferred, 'bottom', 'top', 'right', 'left'].filter(Boolean);
  for (const key of order) {
    const o = options[key];
    if (o.top >= MARGIN && o.top + card.h <= vp.h - MARGIN && o.left >= MARGIN && o.left + card.w <= vp.w - MARGIN) return o;
  }
  return { top: Math.max(MARGIN, vp.h - card.h - 20), left: Math.max(MARGIN, vp.w - card.w - 20) };
}

export default function OnboardingOverlay({ index, onNext, onFinish, onSkip }) {
  const { t } = useI18n();
  const steps = useMemo(() => buildSteps(t), [t]);
  const step = steps[index];
  const total = steps.length;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [rect, setRect] = useState(null);
  const [fallback, setFallback] = useState(false);
  const [cardSize, setCardSize] = useState({ w: 340, h: 220 });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef(null);
  const baselineRef = useRef(undefined);
  const advancedRef = useRef(false);
  const scrolledRef = useRef(false);
  const missingSinceRef = useRef(null);
  const pathRef = useRef(pathname);
  const projectPathRef = useRef(null);
  pathRef.current = pathname;
  if (pathname.startsWith('/proyectos/')) projectPathRef.current = pathname;

  const onRightPage = step.where === 'any' || (step.where === 'dashboard' ? pathname === '/' : pathname.startsWith('/proyectos/'));

  // Al cambiar de paso se reinicia todo el seguimiento.
  useEffect(() => {
    // El punto de partida se toma al instante: si el usuario actúa muy rápido, el cambio igual cuenta.
    // Si el elemento aún no existe, `setup` devuelve undefined y el intervalo lo reintenta.
    baselineRef.current = step.setup ? step.setup() : null;
    advancedRef.current = false;
    scrolledRef.current = false;
    missingSinceRef.current = null;
    setRect(null);
    setFallback(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (index >= total - 1) onFinish();
    else onNext();
  }, [index, total, onNext, onFinish]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Sigue al elemento señalado (puede moverse, cambiar de tamaño o aparecer más tarde).
  useEffect(() => {
    if (!step.target || !onRightPage) {
      setRect(null);
      return undefined;
    }
    let raf;
    const frame = () => {
      const el = step.target();
      if (el) {
        missingSinceRef.current = null;
        const r = el.getBoundingClientRect();
        if (!scrolledRef.current) {
          scrolledRef.current = true;
          if (r.top < 70 || r.bottom > window.innerHeight - 60) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        setRect((prev) => (sameRect(prev, r) ? prev : { top: r.top, left: r.left, width: r.width, height: r.height }));
        setFallback((f) => (f ? false : f));
      } else {
        if (missingSinceRef.current === null) missingSinceRef.current = Date.now();
        setRect((prev) => (prev ? null : prev));
        if (Date.now() - missingSinceRef.current > 7000) setFallback((f) => (f ? f : true));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, onRightPage]);

  // Detecta que el usuario hizo la acción pedida.
  useEffect(() => {
    if (!step.isDone) return undefined;
    const id = setInterval(() => {
      if (baselineRef.current === undefined) {
        baselineRef.current = step.setup ? step.setup() : null;
        if (baselineRef.current === undefined) return;
      }
      if (step.isDone(baselineRef.current, { pathname: pathRef.current })) advance();
    }, 150);
    return () => clearInterval(id);
  }, [step, advance]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w !== cardSize.w || h !== cardSize.h) setCardSize({ w, h });
  });

  const hasTarget = !!step.target;
  const showCard = onRightPage && (!hasTarget || !!rect || fallback);
  const pos = placeCard(hasTarget ? rect : null, cardSize, vp, step.placement);
  const hole = rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;
  const blocker = { position: 'fixed', background: DIM, zIndex: Z, pointerEvents: 'auto' };
  const isAction = !!step.isDone;

  const content = (
    <>
      {onRightPage && (!hole || !hasTarget) && <div style={{ ...blocker, inset: 0 }} />}
      {onRightPage && hasTarget && hole && (
        <>
          <div style={{ ...blocker, top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }} />
          <div style={{ ...blocker, top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div style={{ ...blocker, top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
          <div style={{ ...blocker, top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          {step.blockTarget && <div style={{ position: 'fixed', zIndex: Z, pointerEvents: 'auto', top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />}
          <div
            className="tour-ring"
            aria-hidden="true"
            style={{ position: 'fixed', zIndex: Z + 1, pointerEvents: 'none', top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: '12px', border: `2px solid ${colors.primary}` }}
          />
        </>
      )}

      {showCard && (
        <div
          ref={cardRef}
          role="dialog"
          aria-live="polite"
          aria-label={step.title}
          data-testid="tour-card"
          style={{
            position: 'fixed',
            zIndex: Z + 2,
            top: pos.top,
            left: pos.left,
            width: 'min(340px, calc(100vw - 24px))',
            boxSizing: 'border-box',
            padding: '18px 20px 14px',
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            boxShadow: `0 12px 32px ${colors.shadow}`,
            fontFamily: fonts.body,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ font: `700 11px ${fonts.body}`, letterSpacing: '.06em', textTransform: 'uppercase', color: colors.primaryDark }}>
              {t(`Paso ${index + 1} de ${total}`, `Step ${index + 1} of ${total}`)}
            </span>
            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: colors.border, overflow: 'hidden' }}>
              <div style={{ width: `${((index + 1) / total) * 100}%`, height: '100%', background: colors.primary, transition: 'width .25s ease' }} />
            </div>
          </div>
          <div style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: '17px', lineHeight: 1.25, marginBottom: '6px' }}>{step.title}</div>
          <div style={{ fontSize: '14px', lineHeight: 1.5, color: colors.textMuted }}>{step.body}</div>

          {fallback ? (
            <div style={{ marginTop: '12px', fontSize: '13px', color: colors.textMuted }}>
              {t('No encontramos este elemento en pantalla. Puedes seguir con el siguiente paso.', "We couldn't find this element on screen. You can move on to the next step.")}
            </div>
          ) : (
            isAction && (
              <div data-testid="tour-hint" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: colors.primaryTint, color: colors.primaryDark, font: `600 13px ${fonts.body}` }}>
                <span className="tour-dot" aria-hidden="true" />
                {step.hint}
              </div>
            )
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '14px' }}>
            <button
              type="button"
              data-testid="tour-skip"
              onClick={onSkip}
              style={{ background: 'transparent', border: 'none', padding: 0, color: colors.textMuted, font: `500 12px ${fonts.body}`, textDecoration: 'underline', cursor: 'pointer' }}
            >
              {t('Omitir tutorial', 'Skip tutorial')}
            </button>
            {(step.button || fallback) && (
              <button
                type="button"
                data-testid="tour-next"
                onClick={advance}
                style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 18px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
              >
                {fallback && !step.button ? t('Continuar', 'Continue') : step.button}
              </button>
            )}
          </div>
        </div>
      )}

      {!onRightPage && (
        <div
          role="dialog"
          aria-label={t('Tutorial en pausa', 'Tutorial paused')}
          data-testid="tour-paused"
          style={{ position: 'fixed', zIndex: Z + 2, right: 20, bottom: 20, width: 'min(320px, calc(100vw - 24px))', boxSizing: 'border-box', padding: '16px 18px', background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: '14px', boxShadow: `0 12px 32px ${colors.shadow}`, fontFamily: fonts.body }}
        >
          <div style={{ fontSize: '14px', lineHeight: 1.5, color: colors.textMuted, marginBottom: '12px' }}>
            {step.where === 'project'
              ? t('Para continuar el tutorial, vuelve a tu proyecto.', 'To continue the tutorial, go back to your project.')
              : t('Para continuar el tutorial, vuelve a Mis proyectos.', 'To continue the tutorial, go back to My projects.')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <button type="button" onClick={onSkip} style={{ background: 'transparent', border: 'none', padding: 0, color: colors.textMuted, font: `500 12px ${fonts.body}`, textDecoration: 'underline', cursor: 'pointer' }}>
              {t('Omitir tutorial', 'Skip tutorial')}
            </button>
            <button
              type="button"
              onClick={() => navigate(step.where === 'project' && projectPathRef.current ? projectPathRef.current : '/')}
              style={{ background: colors.primaryStrong, color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 16px', font: `600 14px ${fonts.body}`, cursor: 'pointer' }}
            >
              {step.where === 'project' ? t('Volver a mi proyecto', 'Back to my project') : t('Ir a Mis proyectos', 'Go to My projects')}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(content, document.body);
}
