'use client';

import { useRef, useState } from 'react';
import { Camera, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LimaBarProps {
  /** When provided, tapping the bar opens this route instead of the chat overlay */
  chatHref?: string;
  placeholder?: string;
}

/**
 * Persistent Lima ask-bar — sits at the bottom of main screens above the tab bar.
 * Tapping the input routes to the Lima chat (farmer page with chat open).
 * The camera button routes to chat with the photo mode hinted.
 */
export default function LimaBar({ chatHref = '/farmer?chat=1', placeholder = 'Ask Lima anything...' }: LimaBarProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function openChat(e: React.FormEvent) {
    e.preventDefault();
    const dest = value.trim()
      ? `${chatHref}&q=${encodeURIComponent(value.trim())}`
      : chatHref;
    router.push(dest);
  }

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5"
      style={{
        background: '#FFFEFA',
        borderTop: '1px solid #E2D8C4',
        flexShrink: 0,
      }}
    >
      {/* Lima avatar */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))', borderRadius: 10 }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21V11" />
          <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
          <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
        </svg>
      </div>

      {/* Text input */}
      <form onSubmit={openChat} className="flex-1 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 outline-none font-sans bg-transparent"
          style={{
            height: 40,
            padding: '0 14px',
            borderRadius: 10,
            background: '#fff',
            border: '1px solid #D8CBB2',
            color: '#20190F',
            fontSize: 14,
            fontWeight: 500,
          }}
          onFocus={() => inputRef.current?.select()}
        />
        {value.trim() && (
          <button
            type="submit"
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))', borderRadius: 10, border: 'none', boxShadow: '0 2px 8px rgba(31,77,43,0.25)' }}
          >
            <Send size={16} color="#F7F2E9" />
          </button>
        )}
      </form>

      {/* Camera */}
      <button
        type="button"
        onClick={() => router.push(`${chatHref}&photo=1`)}
        className="flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
        aria-label="Upload a photo for Lima to diagnose"
        style={{ color: '#5C5040' }}
      >
        <Camera size={22} />
      </button>
    </div>
  );
}
