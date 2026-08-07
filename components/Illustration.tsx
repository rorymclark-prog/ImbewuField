import { Sprout } from 'lucide-react';

export type IllustrationName = 'login-hero' | 'empty-sprout' | 'example-hero';

export interface IllustrationProps {
  name: IllustrationName;
  className?: string;
}

// Code-side prep for the 3 Recraft assets requested in RECRAFT-ASSET-BRIEF-2026-08-07.md.
// These currently render styled placeholders. When the final raster assets are approved
// and downloaded, drop them into /public/assets/ and replace this with standard <img> tags.
export default function Illustration({ name, className = '' }: IllustrationProps) {
  if (name === 'empty-sprout') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: 80, height: 80, background: '#F7F2E9', borderRadius: '50%', border: '1px dashed #D4922A' }}>
        <Sprout size={32} style={{ color: '#D4922A', opacity: 0.5 }} />
      </div>
    );
  }

  if (name === 'login-hero') {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ background: '#F7F2E9', border: '1px dashed #D4922A', borderRadius: 16 }}>
        <span className="font-display font-semibold text-sm" style={{ color: '#D4922A' }}>[ Login Hero Placeholder ]</span>
        <span className="font-sans text-xs mt-1" style={{ color: '#8C7A62' }}>Smallholding scene, beds + water tank, warm morning light</span>
      </div>
    );
  }

  if (name === 'example-hero') {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ background: '#F7F2E9', border: '1px dashed #D4922A', borderRadius: 16 }}>
        <span className="font-display font-semibold text-sm" style={{ color: '#D4922A' }}>[ Example Hero Placeholder ]</span>
        <span className="font-sans text-xs mt-1" style={{ color: '#8C7A62' }}>Smallholding scene, wide aspect header</span>
      </div>
    );
  }

  return null;
}
