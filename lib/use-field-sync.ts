'use client';
import { useEffect, useRef } from 'react';
import { FIELD_SYNCED } from './field-request-model';
export function useFieldSync(refresh: () => void, enabled = true) {
  const current = useRef({ refresh, enabled }); current.current = { refresh, enabled };
  useEffect(() => { const run = () => { if (current.current.enabled) current.current.refresh(); }; window.addEventListener(FIELD_SYNCED, run); return () => window.removeEventListener(FIELD_SYNCED, run); }, []);
}
