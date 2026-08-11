'use client';

// Preview & Export (2.0) — Rory's tablet mockup, at its own route beside the 2.0 studio shell.
//
// Same reasoning as app/design-studio-2/page.tsx: this stands next to app/design/page.tsx rather
// than inside it, so the new screen can be looked at without touching the ~200KB wizard farmers
// use today. See components/design-studio-2/PreviewExport.tsx for what the mockup asked for and
// the three places design/PREVIEW-EXPORT-V2.md §3 says not to follow it.
export { default } from '@/components/design-studio-2/PreviewExport';
