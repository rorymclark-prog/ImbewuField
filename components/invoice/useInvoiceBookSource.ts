'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useInvoiceStorageStatus } from '@/components/InvoiceStorageStatus';
import { readInvoiceBook, invoiceBookIsCurrent, releaseInvoiceBook, type InvoiceBookRead } from '@/lib/invoices';
import {
  captureInvoiceDocumentContext, invoiceDocumentContextIsCurrent, revokeInvoiceDocumentContext,
  subscribeInvoiceDocumentContext, type InvoiceDocumentContext,
} from '@/lib/length-unit-preference';

export interface InvoiceBookSource {
  readonly book: InvoiceBookRead | null;
  readonly ready: boolean;
  /** A draft withdrawal signal, never a substitute for either private proof. */
  readonly epoch: number;
  readonly isActorCurrent: () => boolean;
  readonly reload: () => InvoiceBookRead | null;
  /** Only call with the genuine book returned by an actual written mutation receipt. */
  readonly adopt: (book: InvoiceBookRead) => boolean;
}

/** A dirty form keeps the source it displayed. Storage events may hold it, but
 * cannot silently refresh its authority or move it into another workspace. */
export function useInvoiceBookSource({ enabled = true }: { enabled?: boolean } = {}): InvoiceBookSource {
  const { user, loading } = useAuth();
  const owner = user?.uid ?? null;
  const delivery = useInvoiceStorageStatus();
  const available = !!delivery && !delivery.busy && (delivery.status?.status === 'sample' || delivery.status?.writable === true);
  const [actor, setActor] = useState<{ context: InvoiceDocumentContext; owner: string | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [book, setBook] = useState<InvoiceBookRead | null>(null);
  const currentBook = useRef<InvoiceBookRead | null>(null);
  const initiallyLoaded = useRef(false);
  const release = useCallback((publish: boolean) => {
    if (currentBook.current) releaseInvoiceBook(currentBook.current);
    currentBook.current = null;
    if (publish) setBook(null);
  }, []);

  useEffect(() => {
    let active = true;
    release(true); setActor(null); setEpoch(value => value + 1);
    if (!enabled) { initiallyLoaded.current = false; return; }
    if (loading) return;
    const context = captureInvoiceDocumentContext();
    if (!context) return;
    setActor({ context, owner });
    const stop = subscribeInvoiceDocumentContext(context, () => {
      if (!active) return;
      release(true);
      setRevision(value => value + 1);
    });
    return () => {
      active = false; stop(); release(false); revokeInvoiceDocumentContext(context);
    };
  }, [enabled, loading, owner, revision, release]);

  // This callback closes the proof from THIS render. Reading a live ref here
  // would let a retained asynchronous handler adopt a later actor after A-B-A.
  const isActorCurrent = useCallback(() => enabled && !loading && !!actor && actor.owner === owner
    && invoiceDocumentContextIsCurrent(actor.context), [enabled, loading, actor, owner]);
  const adopt = useCallback((next: InvoiceBookRead): boolean => {
    if (!available || !isActorCurrent() || !next.writable || !invoiceBookIsCurrent(next) || !isActorCurrent()) return false;
    if (currentBook.current !== next) release(true);
    currentBook.current = next; setBook(next); initiallyLoaded.current = true;
    return true;
  }, [available, isActorCurrent, release]);
  const reload = useCallback((): InvoiceBookRead | null => {
    if (!available || !isActorCurrent()) return null;
    const next = readInvoiceBook();
    if (!isActorCurrent() || !adopt(next)) { releaseInvoiceBook(next); return null; }
    return next;
  }, [available, isActorCurrent, adopt]);

  useEffect(() => {
    if (!enabled || !available || !isActorCurrent() || initiallyLoaded.current) return;
    initiallyLoaded.current = true;
    const next = readInvoiceBook();
    if (!isActorCurrent()) { releaseInvoiceBook(next); return; }
    currentBook.current = next; setBook(next);
  }, [enabled, available, isActorCurrent]);

  return Object.freeze({ book, epoch,
    ready: !!book && available && isActorCurrent() && book.writable && invoiceBookIsCurrent(book),
    isActorCurrent, reload, adopt });
}
