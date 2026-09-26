'use client';

import { Printer } from 'lucide-react';

/** Opens the browser's print dialog (where "Save as PDF" lives on phones and computers). */
export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '10px 16px', borderRadius: 12, background: '#9A6018', color: '#fff', fontWeight: 700, border: 0, cursor: 'pointer' }}
    >
      <Printer size={18} aria-hidden />
      {label}
    </button>
  );
}
