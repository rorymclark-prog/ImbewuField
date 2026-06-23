import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#F7F2E9', padding: 24, textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
        </svg>
      </div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, color: '#20190F', marginBottom: 8 }}>Page not found</h2>
      <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#5C5040', marginBottom: 24 }}>
        That page doesn&rsquo;t exist.
      </p>
      <Link
        href="/home"
        style={{ height: 44, padding: '0 24px', background: '#1F4D2B', color: '#F7F2E9', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
      >
        Go home
      </Link>
    </div>
  );
}
