'use client';

/** Decorative growth follows the five existing farm-plan checks, never a second score. */
export default function ProgressSprout({ completedSteps }: { completedSteps: number }) {
  const stage = Math.max(0, Math.min(5, Math.floor(completedSteps)));
  const stemTop = [44, 40, 34, 28, 23, 18][stage];

  return (
    <svg
      aria-hidden="true"
      className="imf-progress-sprout"
      data-stage={stage}
      viewBox="0 0 80 80"
      fill="none"
    >
      <circle cx="40" cy="39" r="37" fill="rgba(234,243,226,0.08)" />
      <circle cx="60" cy="18" r="4" fill="rgba(247,201,126,0.9)" />
      <path d="M17 62c12-4 34-4 46 0" stroke="#A5BD87" strokeWidth="2" strokeLinecap="round" />
      <path d="M31 66h18" stroke="#D9BC88" strokeWidth="3" strokeLinecap="round" />
      <g className="imf-progress-sprout__growth">
        <path d={`M40 58Q38 45 40 ${stemTop}`} stroke="#D4E4B2" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 51c-8 0-11-4-11-9 7 0 11 3 11 9Z" fill="#A9CE79" />
        <path d="M40 49c1-7 5-10 11-10-1 6-5 9-11 10Z" fill="#D4E4B2" />
        {stage >= 2 && <path d="M40 40C29 40 26 34 26 29c9 0 14 4 14 11Z" fill="#A9CE79" />}
        {stage >= 3 && <path d="M40 34c1-9 6-13 15-13-1 8-6 12-15 13Z" fill="#D4E4B2" />}
        {stage >= 4 && <path d="M40 28c-7 0-10-5-10-10 7 0 10 4 10 10Z" fill="#A9CE79" />}
        {stage >= 5 && <circle cx="40" cy="17" r="5" fill="#F7C97E" />}
      </g>
    </svg>
  );
}
