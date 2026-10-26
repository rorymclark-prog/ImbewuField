import AppHeader from '@/components/layout/AppHeader';

/** The manual's top bar: the shared app header (logo, Back, primary nav, Settings) with the manual title as its label. */
export default function ManualHeader({ fallback, label }: { fallback: string; label: string }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <AppHeader title={label} backFallback={fallback} />
    </div>
  );
}
