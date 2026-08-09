'use client';

// Design Studio Shell (v2) — comparison scaffold for feature/design-studio-2.
//
// Lives at its own route rather than replacing app/design/page.tsx in place: that file is
// ~200KB of tightly-coupled wizard state (DesignWizard/StepGuide/DesignCanvas all wired
// together), used in production today. This route lets the new shell be reviewed side by side
// with it before any decision to cut over. See the task report for the full reasoning.
export { default } from '@/components/design-studio-2/StudioShell';
