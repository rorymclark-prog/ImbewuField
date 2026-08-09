'use client';

// The IDENTITY bar — row one of a two-row header.
//
// The design mock had one row carrying seven unrelated jobs: wordmark, site name, Learn,
// Guided/Pro, Preview map, Print/Export and save state, all at the same visual weight. That
// row is doing identity ("where am I, whose farm, is my work safe") AND navigation AND the
// terminal action of the whole flow. Splitting it gives each row one job:
//
//   row 1 (here)      — who/what/where + is it saved + undo   ... changes almost never
//   row 2 (TopStepper)— which sheet am I on                   ... changes every step
//
// Three deliberate corrections to the mock live in this file:
//
//  1. SAVE STATE IS NOT A BUTTON. The mock styled "Saved" as a pill with an icon sitting in a
//     row of buttons, so it read as clickable. It is status, and globals.css already has the
//     right primitive for status — `.u-status` (word + dot + soft tint, "never a solid
//     saturated block"). Used verbatim rather than restyled.
//  2. NEWSREADER APPEARS BELOW THE WORDMARK. app/globals.css puts every h1–h6 on
//     --font-display, but the mock used the serif once, for the logo, which turns a real type
//     pairing into a logotype and leaves the app with no voice. The wordmark here and the
//     sheet title in RightPanel are the two serif anchors — one per region, nowhere else.
//  3. UNDO/REDO LIVE HERE, not at the bottom of the left rail. In the rail they sat at the
//     furthest point in the window from both the map and the header, which is the wrong place
//     for the control you reach for fastest after a mistake.

import { Redo2, Undo2 } from 'lucide-react';
import BackButton from '@/components/BackButton';

interface IdentityBarProps {
  siteName: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Nothing persists in this shell yet (see StudioShell's PERSISTENCE note), so this reports
   *  whether there is unsaved WORK, not a real write. Wording stays honest either way. */
  dirty: boolean;
}

export default function IdentityBar({
  siteName, onUndo, onRedo, canUndo, canRedo, dirty,
}: IdentityBarProps) {
  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b px-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/*
        components/BackControl.tsx's own doc comment: a page with no in-flow back control gets a
        FLOATING fallback pill — which "dropped a fixed pill on top of the left-hand tool panel on
        the map" the last time a Design Studio screen skipped this (a named, already-fixed overlap
        class). Rendering the shared BackButton registers this page as in-flow
        (BackButton -> useRegisterBackControl) so that fallback stands down. It moved here from the
        stepper with the rest of the identity controls; the registration is what matters, and back
        belongs beside where-am-I rather than inside which-sheet-am-I-on.
      */}
      <BackButton fallback="/home" />
      <span className="h-5 w-px shrink-0" style={{ background: 'var(--border)' }} />

      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className="min-w-0 truncate text-[17px] font-bold leading-none sm:shrink-0 sm:text-[19px]"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-strong)', letterSpacing: '-0.02em' }}
        >
          ImbewuField
        </span>
        <span
          className="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none sm:block"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          2.0
        </span>
        <span className="mx-1 hidden h-4 w-px shrink-0 sm:block" style={{ background: 'var(--border)' }} />
        <span className="hidden min-w-0 truncate text-sm font-semibold sm:block" style={{ color: 'var(--text)' }}>
          {siteName}
        </span>
      </div>

      <div className="flex-1" />

      {/* GUIDED / PRO IS GONE, and it is worth writing down why so it does not come back.
          In the current studio (app/design/page.tsx + DesignPalette.tsx) the mode does exactly
          one thing: `allowedCategories = mode === 'pro' ? 'all' : categoriesForStep(step)`.
          That is the whole feature — "show me every element instead of this step's elements".
          This palette already answers that question, better, with the "All" tab and its inline
          group headings. So Pro was a persistent, global, up-front preference standing in for a
          per-moment question the palette now answers where the question is actually asked.
          A mode toggle is never free: it splits the product into two states to design, test and
          support, and it makes a farmer choose an identity before placing a single tree. */}

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)] disabled:opacity-25 disabled:hover:bg-transparent"
          style={{ color: 'var(--text-2)' }}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)] disabled:opacity-25 disabled:hover:bg-transparent"
          style={{ color: 'var(--text-2)' }}
        >
          <Redo2 size={17} />
        </button>
      </div>

      {/* Status, not an action. `.u-status` supplies the dot and the soft tint. */}
      {/* Wrapped rather than given `hidden` directly: `.u-status` sets display:inline-flex as a
          plain class, so it ties with Tailwind's `.hidden` on specificity and wins or loses on
          source order — which is how this pill kept rendering on a 390px phone and pushing the
          bar into overflow. The wrapper has no competing display rule, so it always wins. */}
      <span className="hidden shrink-0 md:block">
      <span
        className={`u-status ${dirty ? 'u-status-warn' : ''}`}
        style={dirty ? undefined : { background: 'var(--surface-2)', color: 'var(--text-3)' }}
        role="status"
        aria-live="polite"
      >
        {/* NOT "All changes saved" on an empty design. This shell persists nothing yet (see
            StudioShell's PERSISTENCE note), so a green tick claiming the farmer's work is safe
            would be the app's most expensive kind of lie — confident, reassuring and false.
            "Nothing placed yet" is true, and the warning state is true the moment it is not. */}
        {dirty ? 'Not saved yet' : 'Nothing placed yet'}
      </span>
      </span>
    </header>
  );
}
