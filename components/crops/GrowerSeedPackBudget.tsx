'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type {
  GrowerSeedSourcingReview,
  GrowerFieldSeedSourcingReview,
} from '@/lib/international/grower-seed-sourcing';
import {
  reviewSeedPackCost,
  type SeedPackCostReview,
} from '@/lib/seed-pack-cost';
import {
  INVOICE_PILOT_CURRENCIES,
  inspectInvoiceCurrencyBasis,
} from '@/lib/invoice-currency';
import {
  formatRecordedMoney,
  type FormattingContext,
} from '@/lib/international/locales/formatting';
import {
  addDecimalQuantity,
  decimalQuantityNumber,
  compareDecimalQuantities,
  type DecimalQuantity,
} from '@/lib/farm-records';

export interface GrowerSeedPackBudgetProps {
  reviewProof: object;
  review: GrowerSeedSourcingReview | GrowerFieldSeedSourcingReview;
  isCurrent: (capturedProof: object) => boolean;
  disabled: boolean;
  sample: boolean;
  formatting: FormattingContext;
}

interface EditorState {
  readonly currencyCode: string;
  readonly prices: ReadonlyMap<string, string>;
}

const EMPTY_PRICES: ReadonlyMap<string, string> = Object.freeze(new Map());

function failureExplanation(reason: string | null): string {
  if (!reason) return 'Please enter a valid price.';
  switch (reason) {
    case 'string-required':
      return 'Price must be entered as text.';
    case 'input-length-exceeded':
      return 'Entered price is too long.';
    case 'incomplete-number':
      return 'Please finish entering the decimal number.';
    case 'plain-decimal-required':
      return 'Enter a plain decimal number using dot or comma as decimal separator.';
    case 'outside-finite-range':
      return 'Entered price is outside the supported numeric range.';
    case 'decimal-representation-loss':
      return 'Entered price cannot be represented exactly.';
    case 'negative-price-rejected':
      return 'Price cannot be negative.';
    case 'currency-code-string-required':
      return 'Please choose a currency from the list.';
    case 'currency-outside-pilot':
    case 'unsupported-currency-basis':
      return 'Selected currency is not supported.';
    case 'invalid-pack-count':
      return 'Pack count for this group is invalid.';
    case 'invalid-factor':
    case 'work-limit':
      return 'Calculation could not be completed safely.';
    default:
      return 'Please review the entered price.';
  }
}

export default function GrowerSeedPackBudget({
  reviewProof,
  review,
  isCurrent,
  disabled,
  sample,
  formatting,
}: GrowerSeedPackBudgetProps) {
  const componentInstanceId = useId();

  const [editor, setEditor] = useState<EditorState>({
    currencyCode: '',
    prices: EMPTY_PRICES,
  });

  const [lifetimeToken, setLifetimeToken] = useState<object | null>(null);

  const activeLifetimeRef = useRef<object | null>(null);
  const activeProofRef = useRef<object | null>(null);
  const activeReviewRef = useRef<GrowerSeedSourcingReview | GrowerFieldSeedSourcingReview | null>(null);
  const retiredProofsRef = useRef<WeakSet<object>>(new WeakSet());
  const editorRef = useRef<EditorState>(editor);
  editorRef.current = editor;

  // The same proof/editor can survive a parent render; its old handlers cannot.
  const currentRenderOwnerToken = {};
  const renderOwnerTokenRef = useRef<object>(currentRenderOwnerToken);
  renderOwnerTokenRef.current = currentRenderOwnerToken;

  const latestPropsRef = useRef({
    reviewProof,
    review,
    isCurrent,
    disabled,
  });
  latestPropsRef.current = {
    reviewProof,
    review,
    isCurrent,
    disabled,
  };

  // Proof / review identity synchronization during render
  if (activeProofRef.current !== reviewProof) {
    if (activeProofRef.current !== null) {
      retiredProofsRef.current.add(activeProofRef.current);
    }
    activeProofRef.current = reviewProof;
    activeReviewRef.current = review;
    const freshEditor: EditorState = { currencyCode: '', prices: EMPTY_PRICES };
    editorRef.current = freshEditor;
    setEditor(freshEditor);
  } else if (activeReviewRef.current !== review) {
    retiredProofsRef.current.add(reviewProof);
    activeReviewRef.current = review;
    const freshEditor: EditorState = { currencyCode: '', prices: EMPTY_PRICES };
    editorRef.current = freshEditor;
    setEditor(freshEditor);
  }

  useEffect(() => {
    const setupToken = {};
    activeLifetimeRef.current = setupToken;
    setLifetimeToken(setupToken);

    return () => {
      activeLifetimeRef.current = null;
      renderOwnerTokenRef.current = {};
    };
  }, []);

  // Capture render owner and active tokens outside all handlers
  const capturedRenderOwner = currentRenderOwnerToken;
  const capturedLifetime = lifetimeToken;
  const capturedProof = reviewProof;
  const capturedReview = review;
  const capturedEditor = editor;

  // Currentness check: when not disabled, evaluate parent currentness.
  // Retire proof on genuine parent rejection or thrown exception.
  let currentProofValid = false;
  if (!retiredProofsRef.current.has(reviewProof)) {
    if (disabled) {
      currentProofValid = false;
    } else {
      try {
        if (isCurrent(reviewProof) === true) {
          currentProofValid = true;
        } else {
          retiredProofsRef.current.add(reviewProof);
          currentProofValid = false;
        }
      } catch {
        retiredProofsRef.current.add(reviewProof);
        currentProofValid = false;
      }
    }
  }

  const isOperable =
    capturedLifetime !== null &&
    capturedLifetime === activeLifetimeRef.current &&
    currentProofValid &&
    !disabled &&
    (review.status === 'available' || review.status === 'partial');

  function handlerIsCurrent() {
    return capturedLifetime !== null
      && activeLifetimeRef.current === capturedLifetime
      && renderOwnerTokenRef.current === capturedRenderOwner
      && editorRef.current === capturedEditor
      && latestPropsRef.current.reviewProof === capturedProof
      && latestPropsRef.current.review === capturedReview
      && !latestPropsRef.current.disabled
      && !retiredProofsRef.current.has(capturedProof);
  }

  function retireCapturedProof() {
    retiredProofsRef.current.add(capturedProof);
    // A rejection discovered by an event must withdraw visible costs now, even
    // if the parent has not rendered since its source/account changed.
    // A currentness check can synchronously render the same proof. Its rejection
    // still withdraws that proof, but must not clear a replacement review.
    if (activeLifetimeRef.current === null
      || latestPropsRef.current.reviewProof !== capturedProof
      || latestPropsRef.current.review !== capturedReview) return;
    const withdrawnEditor: EditorState = { currencyCode: '', prices: EMPTY_PRICES };
    editorRef.current = withdrawnEditor;
    setEditor(withdrawnEditor);
  }

  function handleCurrencyChange(newRawCurrency: string) {
    if (!handlerIsCurrent()) return;

    try {
      if (latestPropsRef.current.isCurrent(capturedProof) !== true) {
        retireCapturedProof();
        return;
      }
    } catch {
      retireCapturedProof();
      return;
    }

    if (!handlerIsCurrent()) return;

    let admittedCurrency = '';
    if (newRawCurrency !== '') {
      const basis = inspectInvoiceCurrencyBasis({ currencyCode: newRawCurrency });
      if (basis.status === 'recorded') {
        admittedCurrency = basis.currency;
      } else {
        return;
      }
    }

    if (admittedCurrency === capturedEditor.currencyCode) {
      return;
    }

    const nextEditor: EditorState = {
      currencyCode: admittedCurrency,
      prices: EMPTY_PRICES,
    };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
  }

  function handlePriceChange(groupId: string, rawText: string) {
    if (!handlerIsCurrent()) return;

    try {
      if (latestPropsRef.current.isCurrent(capturedProof) !== true) {
        retireCapturedProof();
        return;
      }
    } catch {
      retireCapturedProof();
      return;
    }

    if (!handlerIsCurrent() || typeof rawText !== 'string') return;

    const nextPrices = new Map(capturedEditor.prices);
    nextPrices.set(groupId, rawText);
    const nextEditor: EditorState = {
      currencyCode: capturedEditor.currencyCode,
      prices: nextPrices,
    };
    editorRef.current = nextEditor;
    setEditor(nextEditor);
  }

  // Pre-scan groups: only unique, non-null IDs can be priced
  const groupCounts = new Map<string, number>();
  for (const g of review.groups) {
    if (g.id !== null && typeof g.id === 'string') {
      groupCounts.set(g.id, (groupCounts.get(g.id) ?? 0) + 1);
    }
  }

  const isFieldBasis = review.basis === 'grower-field-seed-sourcing-estimates';
  const prefix = isFieldBasis ? 'Field supply group' : 'Supply group';

  interface PricedGroupItem {
    readonly group: (typeof review.groups)[number];
    readonly publicOrdinal: number;
    readonly usableId: string | null;
    readonly isPricable: boolean;
    readonly costReview: SeedPackCostReview | null;
    readonly packsNeeded: number | null;
  }

  const items: PricedGroupItem[] = [];
  let decimalTotal: DecimalQuantity | undefined = undefined;
  let allLinesComplete = true;
  let anyLinesComplete = false;
  let hasEligibleLines = false;
  let safeSubtotal: number | null = null;
  let subtotalHeld = false;

  for (let i = 0; i < review.groups.length; i++) {
    const group = review.groups[i];
    const usableId =
      group.id !== null && typeof group.id === 'string' && groupCounts.get(group.id) === 1
        ? group.id
        : null;

    const isEligible =
      usableId !== null &&
      group.status === 'complete' &&
      group.counts?.status === 'complete' &&
      group.counts?.packsNeeded !== null &&
      group.counts?.packsNeeded !== undefined;

    if (isEligible) {
      hasEligibleLines = true;
      const packs = group.counts!.packsNeeded!;
      const priceText = isOperable ? editor.prices.get(usableId) ?? '' : '';
      const currencyArg = isOperable && editor.currencyCode !== '' ? editor.currencyCode : null;

      const costReview = reviewSeedPackCost(packs, priceText, currencyArg);

      if (costReview.status === 'complete' && costReview.estimatedCost !== null) {
        anyLinesComplete = true;
        decimalTotal = addDecimalQuantity(decimalTotal, costReview.estimatedCost);
      } else {
        allLinesComplete = false;
      }

      items.push({
        group,
        publicOrdinal: i + 1,
        usableId,
        isPricable: true,
        costReview,
        packsNeeded: packs,
      });
    } else {
      allLinesComplete = false;
      items.push({
        group,
        publicOrdinal: i + 1,
        usableId,
        isPricable: false,
        costReview: null,
        packsNeeded: group.counts?.packsNeeded ?? null,
      });
    }
  }

  if (anyLinesComplete && decimalTotal !== undefined) {
    const numericTotal = decimalQuantityNumber(decimalTotal);
    if (numericTotal === null) {
      subtotalHeld = true;
      safeSubtotal = null;
    } else {
      const roundTrip = addDecimalQuantity(undefined, numericTotal);
      if (compareDecimalQuantities(decimalTotal, roundTrip) !== 0) {
        subtotalHeld = true;
        safeSubtotal = null;
      } else {
        safeSubtotal = numericTotal;
      }
    }
  }

  const isFullyRepresentedBudget =
    isOperable &&
    review.status === 'available' &&
    review.groups.length > 0 &&
    hasEligibleLines &&
    allLinesComplete &&
    !subtotalHeld &&
    safeSubtotal !== null;

  const unassignedCount =
    'unassignedBatchIds' in review
      ? review.unassignedBatchIds.length
      : 'unassignedPlantingIds' in review
        ? review.unassignedPlantingIds.length
        : 0;

  const heldRowCount = 'heldSourceRowCount' in review ? review.heldSourceRowCount : 0;
  const legacyRowCount = 'legacySourceRowCount' in review ? review.legacySourceRowCount : 0;
  const excludedNurseryCount =
    'excludedNurseryCycleCount' in review ? review.excludedNurseryCycleCount : 0;

  const currencySelectId = `${componentInstanceId}-currency-select`;

  return (
    <section
      aria-label="Seed-pack budget"
      className="min-w-0 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] p-4 text-[var(--text-primary)] [overflow-wrap:anywhere]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
        <h2 className="text-xl font-semibold">
          Temporary seed-pack budget
          {sample && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              DEMO
            </span>
          )}
        </h2>
        <span className="text-xs text-[var(--text-secondary)]">
          Planning estimate only · Not an order or recorded expense. Prices are not saved.
        </span>
      </div>

      {isOperable && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3 text-xs text-[var(--text-secondary)] space-y-1">
          <p>
            Coverage: {review.coverage === 'represented-saved-transplant-batches-only'
              ? 'Represented saved transplant batches only'
              : 'Represented accepted non-nursery cycles only'} · Whole-farm coverage not assessed.
          </p>
          {(unassignedCount > 0 || heldRowCount > 0 || legacyRowCount > 0 || excludedNurseryCount > 0) && (
            <p>
              Omitted items:{' '}
              {unassignedCount > 0 && `Unassigned: ${unassignedCount} · `}
              {heldRowCount > 0 && `Held source rows: ${heldRowCount} · `}
              {legacyRowCount > 0 && `Legacy source rows: ${legacyRowCount} · `}
              {excludedNurseryCount > 0 && `Excluded nursery cycles: ${excludedNurseryCount}`}
            </p>
          )}
          {formatting.reason && <p className="text-amber-700">{formatting.reason}</p>}
        </div>
      )}

      {!isOperable ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {disabled
            ? 'Seed-pack budget is temporarily disabled.'
            : !currentProofValid
              ? 'Current planning review is held or unverified.'
              : 'Seed-pack budget is unavailable for this review.'}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor={currencySelectId} className="font-semibold">
              Currency
            </label>
            <select
              id={currencySelectId}
              disabled={disabled}
              value={editor.currencyCode}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm"
            >
              <option value="">Choose currency</option>
              {INVOICE_PILOT_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--text-secondary)]">
              Changing currency clears entered prices. Use a dot or comma for decimals, without grouping separators or currency symbols.
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Displayed costs are rounded for the selected currency. Calculations use the full entered price.
          </p>

          <div className="space-y-3">
            {items.map((item) => {
              const label = item.group.identification?.enteredLabel;
              const title = `${prefix} ${item.publicOrdinal}${label ? ` (${label})` : ''}`;
              const costReview = item.costReview;
              const rawInput = item.usableId ? editor.prices.get(item.usableId) ?? '' : '';
              const priceInputId = `${componentInstanceId}-price-input-${item.publicOrdinal}`;

              return (
                <article
                  key={item.publicOrdinal}
                  className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-3 text-sm"
                  aria-label={title}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
                    <h3 className="font-medium">{title}</h3>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {item.isPricable ? 'Packs planned' : 'Review needed before pricing'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                    <div>
                      <dt className="text-[var(--text-secondary)]">Packs needed</dt>
                      <dd className="font-medium">
                        {item.packsNeeded !== null ? item.packsNeeded : 'Unknown'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-secondary)]">Estimated line cost</dt>
                      <dd className="font-medium">
                        {costReview &&
                        costReview.status === 'complete' &&
                        costReview.estimatedCost !== null &&
                        costReview.currency !== null ? (
                          formatRecordedMoney(
                            { amount: costReview.estimatedCost, currency: costReview.currency },
                            formatting
                          )?.text ?? `${costReview.estimatedCost} ${costReview.currency}`
                        ) : (
                          costReview?.status === 'held' ? 'Unavailable' : 'Unknown'
                        )}
                      </dd>
                    </div>
                  </dl>

                  {item.isPricable && item.usableId && (
                    <div className="space-y-1 pt-1">
                      <label
                        htmlFor={priceInputId}
                        className="block text-xs font-semibold"
                      >
                        Pack price for {title} ({editor.currencyCode || 'Select currency above'})
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id={priceInputId}
                          type="text"
                          inputMode="decimal"
                          value={rawInput}
                          disabled={disabled || editor.currencyCode === ''}
                          onChange={(e) => handlePriceChange(item.usableId!, e.target.value)}
                          placeholder={
                            editor.currencyCode === ''
                              ? 'Choose currency first'
                              : 'Enter pack price'
                          }
                          className="min-h-11 w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-1)] px-3 py-2 text-sm disabled:opacity-50"
                        />
                        {costReview && costReview.status === 'invalid' && (
                          <span className="text-xs text-red-600">
                            {failureExplanation(costReview.reason)}
                          </span>
                        )}
                        {costReview?.status === 'held' && (
                          <span className="text-xs text-red-600">
                            Review the pack count and entered price; this cost cannot be calculated safely.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-0)] p-4 text-sm space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {isFullyRepresentedBudget
                  ? 'Total estimated seed-pack cost'
                  : 'Known subtotal — incomplete budget'}
              </h3>
              <span className="text-base font-bold">
                {subtotalHeld ? (
                  <span className="text-red-600">Unavailable</span>
                ) : safeSubtotal !== null && editor.currencyCode !== '' ? (
                  formatRecordedMoney(
                    { amount: safeSubtotal, currency: editor.currencyCode },
                    formatting
                  )?.text ?? `${safeSubtotal} ${editor.currencyCode}`
                ) : (
                  'Unknown'
                )}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {isFullyRepresentedBudget
                ? 'All represented supply groups in this review are priced with known line costs.'
                : 'Some groups or prices still need review. This subtotal includes only completed lines; missing costs stay unknown.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
