import { Sprout } from 'lucide-react';

export type IllustrationName = 'login-hero' | 'empty-sprout' | 'example-hero';

export interface IllustrationProps {
  name: IllustrationName;
  className?: string;
}

function LoginFarm({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 360 142"
      role="img"
      aria-label="Raised vegetable beds and a water tank on a South African smallholding at sunrise"
      style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 16 }}
    >
      <defs aria-hidden="true">
        <linearGradient id="login-sky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--bg-1, #FFFEFA)" />
          <stop offset="1" stopColor="var(--bg-2, #EDE7DB)" />
        </linearGradient>
        <linearGradient id="login-field" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="var(--gold-dim, #9A6018)" />
          <stop offset="1" stopColor="var(--gold, #C07A1E)" />
        </linearGradient>
      </defs>
      <g aria-hidden="true">
        <rect width="360" height="142" rx="16" fill="url(#login-sky)" />
        <circle cx="291" cy="34" r="16" fill="var(--color-sun, #F2C94C)" opacity="0.9" />
        <circle cx="291" cy="34" r="27" fill="none" stroke="var(--gold, #C07A1E)" strokeWidth="8" opacity="0.1" />

        <path d="M0 72 55 40l36 20 39-28 52 41 44-34 51 29 38-22 45 28v68H0Z" fill="var(--emerald, #3A7518)" opacity="0.3" />
        <path d="M0 84c40-14 75-15 108-4 37 12 69 7 101-5 42-15 90-12 151 10v57H0Z" fill="var(--emerald, #3A7518)" opacity="0.62" />
        <path d="M0 100c55-17 105-14 151 2 47 17 100 15 209-9v49H0Z" fill="var(--bg-3, #E2D8C4)" />

        <path d="M151 89c27-7 55-6 83 2l-20 51h-89Z" fill="url(#login-field)" opacity="0.38" />
        <path d="m163 96 24-3 21 6-12 10-36-4Z" fill="var(--gold-dim, #9A6018)" />
        <path d="m160 105 36 4 12-10v7l-12 10-36-4Z" fill="var(--text-secondary, #5C5040)" />
        <path d="m157 115 32 4 10-8v7l-10 8-32-4Z" fill="var(--gold-dim, #9A6018)" />
        <path d="m155 122 34 4 10-8v7l-10 8-34-4Z" fill="var(--text-secondary, #5C5040)" />
        <g fill="none" stroke="var(--emerald-bright, #5CA030)" strokeWidth="2" strokeLinecap="round">
          <path d="m168 100 1-5m-1 3-3-2m4 1 3-2M181 102l1-6m0 3-3-2m3 1 3-2M187 113l1-5m0 2-3-2m3 1 3-2M172 112l1-5m0 2-3-2m3 1 3-2" />
        </g>

        <path d="M20 111c30-9 65-9 105 1l-7 30H12Z" fill="var(--gold, #C07A1E)" opacity="0.23" />
        <path d="M28 120c28-7 53-6 80 1M25 130c31-6 58-5 86 1" fill="none" stroke="var(--gold-dim, #9A6018)" strokeWidth="3" strokeLinecap="round" opacity="0.65" />

        <path d="M54 75h47v31H54Z" fill="var(--bg-1, #FFFEFA)" stroke="var(--border, #E2D8C4)" strokeWidth="2" />
        <path d="m48 76 29-20 31 20Z" fill="var(--gold, #C07A1E)" />
        <rect x="62" y="87" width="12" height="19" rx="1" fill="var(--text-secondary, #5C5040)" opacity="0.75" />
        <rect x="82" y="83" width="11" height="10" rx="1" fill="var(--blue, #235E86)" opacity="0.7" />

        <ellipse cx="279" cy="72" rx="25" ry="7" fill="var(--blue, #235E86)" />
        <path d="M254 72v39c0 5 11 8 25 8s25-3 25-8V72c0 5-11 8-25 8s-25-3-25-8Z" fill="var(--blue, #235E86)" opacity="0.88" />
        <ellipse cx="279" cy="72" rx="19" ry="4" fill="var(--bg-1, #FFFEFA)" opacity="0.24" />
        <path d="M260 119v9m38-9v9m6-29h10v18" fill="none" stroke="var(--text-secondary, #5C5040)" strokeWidth="3" strokeLinecap="round" />
        <path d="M314 117h8" stroke="var(--blue, #235E86)" strokeWidth="3" strokeLinecap="round" />

        <path d="M229 113c6-16 7-29 4-39m0 12-11-8m11 2 10-10m-12 28-12-7m13-1 13-8" fill="none" stroke="var(--emerald-bright, #5CA030)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="219" cy="76" r="7" fill="var(--emerald, #3A7518)" />
        <circle cx="244" cy="68" r="8" fill="var(--emerald, #3A7518)" />
        <circle cx="218" cy="89" r="8" fill="var(--emerald-bright, #5CA030)" />
        <circle cx="246" cy="80" r="9" fill="var(--emerald-bright, #5CA030)" />

        <path d="M0 141h360" stroke="var(--border-bright, #ECE3C9)" strokeWidth="2" />
      </g>
    </svg>
  );
}

function ExampleFarm({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 720 180"
      role="img"
      aria-label="A wide view of a South African smallholding with raised beds, a homestead, hills and stored rainwater in warm morning light"
      style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 16 }}
    >
      <defs aria-hidden="true">
        <linearGradient id="example-sky" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--bg-1, #FFFEFA)" />
          <stop offset="1" stopColor="var(--bg-2, #EDE7DB)" />
        </linearGradient>
        <linearGradient id="example-soil" x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="var(--gold-dim, #9A6018)" />
          <stop offset="1" stopColor="var(--gold, #C07A1E)" />
        </linearGradient>
      </defs>
      <g aria-hidden="true">
        <rect width="720" height="180" rx="16" fill="url(#example-sky)" />
        <circle cx="595" cy="38" r="19" fill="var(--color-sun, #F2C94C)" opacity="0.9" />
        <circle cx="595" cy="38" r="34" fill="none" stroke="var(--gold, #C07A1E)" strokeWidth="12" opacity="0.1" />

        <path d="M0 90 75 42l58 31 51-42 78 62 60-43 62 41 68-47 70 47 54-31 58 37 66-48 80 54v77H0Z" fill="var(--emerald, #3A7518)" opacity="0.28" />
        <path d="M0 104c75-25 137-25 207-3 59 19 119 15 179-4 87-28 183-20 334 21v62H0Z" fill="var(--emerald, #3A7518)" opacity="0.61" />
        <path d="M0 128c94-24 178-22 256 3 83 26 186 24 303-6 57-15 111-17 161-7v62H0Z" fill="var(--bg-3, #E2D8C4)" />

        <path d="M92 91h78v52H92Z" fill="var(--bg-1, #FFFEFA)" stroke="var(--border, #E2D8C4)" strokeWidth="3" />
        <path d="m80 93 50-34 53 34Z" fill="var(--gold, #C07A1E)" />
        <rect x="105" y="111" width="20" height="32" rx="2" fill="var(--text-secondary, #5C5040)" opacity="0.78" />
        <rect x="139" y="105" width="17" height="16" rx="2" fill="var(--blue, #235E86)" opacity="0.7" />
        <path d="M184 114h33v29h-33Z" fill="var(--bg-1, #FFFEFA)" stroke="var(--border, #E2D8C4)" strokeWidth="2" />
        <path d="m179 115 21-16 22 16Z" fill="var(--gold-dim, #9A6018)" />

        <ellipse cx="578" cy="96" rx="33" ry="9" fill="var(--blue, #235E86)" />
        <path d="M545 96v48c0 6 15 11 33 11s33-5 33-11V96c0 6-15 11-33 11s-33-5-33-11Z" fill="var(--blue, #235E86)" opacity="0.9" />
        <ellipse cx="578" cy="96" rx="25" ry="5" fill="var(--bg-1, #FFFEFA)" opacity="0.26" />
        <path d="M552 155v11m50-11v11m9-45h15v26" fill="none" stroke="var(--text-secondary, #5C5040)" strokeWidth="4" strokeLinecap="round" />
        <path d="M626 147h11" stroke="var(--blue, #235E86)" strokeWidth="4" strokeLinecap="round" />

        <path d="M251 116c57-17 129-15 218 8l-21 56H221Z" fill="url(#example-soil)" opacity="0.32" />
        <g stroke="var(--text-secondary, #5C5040)" strokeWidth="3" strokeLinejoin="round">
          <path d="m258 132 66-10 48 12-21 15-95-8Z" fill="var(--gold-dim, #9A6018)" />
          <path d="m256 141 95 8 21-15v9l-21 15-95-8Z" fill="var(--text-secondary, #5C5040)" />
          <path d="m277 157 72 6 20-12 47 8-29 19H270Z" fill="var(--gold-dim, #9A6018)" />
        </g>
        <g fill="none" stroke="var(--emerald-bright, #5CA030)" strokeWidth="3" strokeLinecap="round">
          <path d="m276 136 1-8m0 4-5-3m5 2 5-4m17 11 1-9m0 5-5-3m5 1 5-4m17 12 1-9m0 5-5-3m5 1 5-4m18 12 1-8m0 4-5-3m5 2 5-4m-54 35 1-8m0 4-5-3m5 2 5-4m24 12 1-8m0 4-5-3m5 2 5-4" />
        </g>

        <path d="M18 144c54-15 104-13 150 5l-9 31H9Z" fill="var(--gold, #C07A1E)" opacity="0.2" />
        <path d="M26 155c44-10 84-8 124 5M22 169c47-9 91-7 132 4" fill="none" stroke="var(--gold-dim, #9A6018)" strokeWidth="4" strokeLinecap="round" opacity="0.62" />

        <path d="M497 140c8-23 9-42 4-58m1 17-17-12m16 3 16-15m-18 43-18-11m19 1 20-13" fill="none" stroke="var(--emerald-bright, #5CA030)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="483" cy="85" r="11" fill="var(--emerald, #3A7518)" />
        <circle cx="518" cy="73" r="12" fill="var(--emerald, #3A7518)" />
        <circle cx="480" cy="106" r="13" fill="var(--emerald-bright, #5CA030)" />
        <circle cx="521" cy="93" r="14" fill="var(--emerald-bright, #5CA030)" />

        <path d="M650 125v45m35-51v51M631 137h72M631 153h72" fill="none" stroke="var(--text-secondary, #5C5040)" strokeWidth="2" opacity="0.55" />
        <path d="M0 179h720" stroke="var(--border-bright, #ECE3C9)" strokeWidth="2" />
      </g>
    </svg>
  );
}

export default function Illustration({ name, className = '' }: IllustrationProps) {
  if (name === 'empty-sprout') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: 80, height: 80, background: '#F7F2E9', borderRadius: '50%', border: '1px dashed #D4922A' }}>
        <Sprout size={32} style={{ color: '#D4922A', opacity: 0.5 }} />
      </div>
    );
  }

  if (name === 'login-hero') return <LoginFarm className={className} />;
  if (name === 'example-hero') return <ExampleFarm className={className} />;
  return null;
}
