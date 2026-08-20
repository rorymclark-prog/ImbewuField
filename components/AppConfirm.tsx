'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * THE app's confirm dialog — the replacement for every native confirm call.
 * (tests/app-confirm.test.ts scans the whole tree for the native call token,
 * with no exception for this file — hence the circumlocution.)
 *
 * Native confirm() is not merely ugly here, it is broken: embedded webviews
 * (the Claude browser pane, some Android PWA wrappers) suppress native dialogs
 * and return `false` without ever showing anything. Every flow gated on
 * window.confirm was silently dead in those environments — the farmer tapped a
 * button and nothing happened. Worse, flows where "Cancel" itself has meaning
 * inverted: the saved-place duplicate guard treated the suppressed `false` as
 * "save as a new place", quietly minting the exact duplicate it exists to
 * prevent.
 *
 * So: one in-app dialog, promise-based, no native chrome anywhere in the flow.
 *
 *   const appConfirm = useAppConfirm();
 *   if (!(await appConfirm({ message: '…', confirmLabel: 'Yes, delete', destructive: true }))) return;
 *
 * Labels are REQUIRED from the call site (no baked-in strings): translated
 * surfaces pass t(...) labels, so this component needs no i18n keys of its own.
 */

export interface AppConfirmOptions {
  /** Bold first line. Optional — short questions read fine as message-only. */
  title?: string;
  /** The question. Plain text; \n\n renders as separate lines. */
  message: string;
  /** The proceed button. Say what happens: "Yes, delete", "Update Ubhejane". */
  confirmLabel: string;
  /** The decline button. Defaults to "Cancel" — pass a translated/meaningful label wherever that isn't right. */
  cancelLabel?: string;
  /** Paints the confirm button the destructive red. Leave off for neutral choices. */
  destructive?: boolean;
}

type AskFn = (opts: AppConfirmOptions) => Promise<boolean>;

const AppConfirmContext = createContext<AskFn | null>(null);

export function useAppConfirm(): AskFn {
  const ask = useContext(AppConfirmContext);
  if (!ask) {
    // The provider lives in app/layout.tsx and is always mounted; reaching this
    // means a component rendered outside the app shell (or a test) — fail loud
    // rather than silently answering "no" to a question nobody saw.
    throw new Error('useAppConfirm must be used inside <AppConfirmProvider> (app/layout.tsx)');
  }
  return ask;
}

interface Pending {
  opts: AppConfirmOptions;
  resolve: (answer: boolean) => void;
}

export default function AppConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const ask = useCallback<AskFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending((previous) => {
        // Two questions can't share one screen. A second ask answers the first
        // "no" (its flow simply doesn't proceed) and takes the stage — in
        // practice this never happens, but a hung promise would leak a flow.
        previous?.resolve(false);
        return { opts, resolve };
      });
    });
  }, []);

  const settle = useCallback((answer: boolean) => {
    setPending((current) => {
      current?.resolve(answer);
      return null;
    });
  }, []);

  // Escape = decline, same as the backdrop. Focus starts on the decline button:
  // a stray Enter on a destructive question must not destroy anything.
  useEffect(() => {
    if (!pending) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKey);
    cancelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <AppConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <div
          onClick={() => settle(false)}
          style={{
            // Above every sheet in the app (SiteSurveySheet is z-50, the chat
            // widget and banners sit below 100): a confirm asked from inside a
            // full-screen sheet must land on top of that sheet.
            position: 'fixed', inset: 0, zIndex: 1200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(32,25,15,0.45)', padding: 16,
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.opts.title ?? pending.opts.message}
            onClick={(e) => e.stopPropagation()}
            className="font-sans"
            style={{
              width: '100%', maxWidth: 360, borderRadius: 16, padding: '18px 18px 14px',
              background: '#FFFEFA', border: '1px solid #E2D8C4',
              boxShadow: '0 12px 40px rgba(0,0,0,0.28)', color: '#20190F',
            }}
          >
            {pending.opts.title && (
              <div className="font-display font-semibold" style={{ fontSize: 16, marginBottom: 6 }}>
                {pending.opts.title}
              </div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line', color: '#20190F' }}>
              {pending.opts.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
              <button
                ref={cancelRef}
                onClick={() => settle(false)}
                className="font-display font-semibold rounded-xl"
                style={{
                  minHeight: 44, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                  background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040',
                }}
              >
                {pending.opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => settle(true)}
                className="font-display font-semibold rounded-xl"
                style={{
                  minHeight: 44, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                  background: pending.opts.destructive ? '#B33A3A' : '#1F4D2B',
                  border: `1px solid ${pending.opts.destructive ? '#B33A3A' : '#1F4D2B'}`,
                  color: '#FFFFFF',
                }}
              >
                {pending.opts.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppConfirmContext.Provider>
  );
}
