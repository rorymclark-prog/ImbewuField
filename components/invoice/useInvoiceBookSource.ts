'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useInvoiceStorageStatus } from '@/components/InvoiceStorageStatus';
import { readInvoiceBook, invoiceBookIsCurrent, releaseInvoiceBook, type InvoiceBookRead } from '@/lib/invoices';
import { readInvoiceView, invoiceReadViewIsCurrent, subscribeInvoiceReadView, releaseInvoiceReadView, type InvoiceReadView } from '@/lib/invoices';
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

export interface InvoiceReadSource {
  readonly view: InvoiceReadView | null;
  readonly epoch: number;
  readonly isActorCurrent: () => boolean;
  readonly isCurrent: () => boolean;
  readonly reload: () => InvoiceReadView | null;
}

const heldRead = (reason: string): InvoiceReadView => Object.freeze({ status: 'held', reason, retainedUnreadableRows: 0 });

/** Viewing coherent saved invoices never asks the editor provider for a lock.
 * A withdrawn read is held until an explicit action under the current actor. */
export function useInvoiceReadSource({ enabled = true }: { enabled?: boolean } = {}): InvoiceReadSource {
  const { user, loading } = useAuth();
  const owner = user?.uid ?? null;
  const generation = useRef(0), withdrawn = useRef(false);
  const previousActor = useRef<{ owner: string | null; initialized: boolean } | null>(null);
  const current = useRef<{ view: InvoiceReadView; stop: () => void } | null>(null);
  const [actor, setActor] = useState<{ context: InvoiceDocumentContext; owner: string | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const [delivery, setDelivery] = useState<{ view: InvoiceReadView | null; epoch: number }>({ view: null, epoch: 0 });

  const release = useCallback(() => {
    const prior = current.current; current.current = null;
    if (prior) { prior.stop(); releaseInvoiceReadView(prior.view); }
  }, []);
  const withdraw = useCallback((reason: string) => {
    // Invalidate retained callbacks before publishing React state. A same-batch
    // selector or refresh cannot spend the source that is being withdrawn.
    const epoch = ++generation.current; withdrawn.current = true;
    release(); setDelivery({ view: heldRead(reason), epoch });
  }, [release]);
  const capture = useCallback((isAllowed: () => boolean): InvoiceReadView | null => {
    if (!isAllowed()) return null;
    const epoch = ++generation.current; release();
    const next = readInvoiceView();
    if (!isAllowed() || generation.current !== epoch) { releaseInvoiceReadView(next); return null; }
    if (next.status !== 'held') {
      const slot = { view: next, stop: () => {} };
      current.current = slot;
      const stop = subscribeInvoiceReadView(next, () => {
        if (current.current === slot) withdraw('invoice-source-changed');
      });
      slot.stop = stop;
      if (current.current !== slot || generation.current !== epoch || !isAllowed() || !invoiceReadViewIsCurrent(next)) {
        stop(); releaseInvoiceReadView(next); return null;
      }
    }
    setDelivery({ view: next, epoch }); return next;
  }, [release, withdraw]);

  useEffect(() => {
    let active = true;
    const prior = previousActor.current;
    if (prior && (prior.owner !== owner || prior.initialized && (!enabled || loading))) withdrawn.current = true;
    previousActor.current = { owner, initialized: !!prior?.initialized || enabled && !loading };
    const epoch = ++generation.current; release(); setActor(null);
    if (!enabled || loading) {
      setDelivery({ view: heldRead(enabled ? 'invoice-context-loading' : 'invoice-view-disabled'), epoch });
      return () => { active = false; ++generation.current; release(); };
    }
    const context = captureInvoiceDocumentContext();
    if (!context) { setDelivery({ view: heldRead('invoice-context-changed'), epoch }); return; }
    const isAllowed = () => active && invoiceDocumentContextIsCurrent(context);
    setActor({ context, owner });
    const stop = subscribeInvoiceDocumentContext(context, () => {
      if (!active) return;
      withdraw('invoice-context-changed'); setRevision(value => value + 1);
    });
    if (withdrawn.current) setDelivery({ view: heldRead('invoice-context-changed'), epoch: generation.current });
    else capture(isAllowed);
    return () => {
      active = false; ++generation.current; stop(); release(); revokeInvoiceDocumentContext(context);
    };
  }, [enabled, loading, owner, revision, capture, release, withdraw]);

  // Both callbacks close THIS render's actor and read generation. A live ref
  // would let an old handler silently adopt a later account or refreshed book.
  const isActorCurrent = useCallback(() => enabled && !loading && !!actor && actor.owner === owner
    && invoiceDocumentContextIsCurrent(actor.context), [enabled, loading, actor, owner]);
  const isCurrent = useCallback(() => {
    const view = delivery.view;
    return isActorCurrent() && generation.current === delivery.epoch && !!view && view.status !== 'held'
      && invoiceReadViewIsCurrent(view) && generation.current === delivery.epoch && isActorCurrent();
  }, [delivery, isActorCurrent]);
  const reload = useCallback(() => {
    if (!isActorCurrent() || generation.current !== delivery.epoch) return null;
    if (delivery.view && delivery.view.status !== 'held' && !isCurrent()) return null;
    return capture(isActorCurrent);
  }, [delivery, isActorCurrent, isCurrent, capture]);

  return Object.freeze({ view: delivery.view, epoch: delivery.epoch, isActorCurrent, isCurrent, reload });
}
