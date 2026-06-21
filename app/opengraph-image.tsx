import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ImbewuField — permaculture planning for South African farmers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'center', padding: '90px',
          background: 'linear-gradient(135deg, #0b1810 0%, #122416 100%)', color: '#e8f0e6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '92px', height: '92px', borderRadius: '22px', background: 'rgba(72,168,100,0.18)', border: '2px solid rgba(72,168,100,0.5)', fontSize: '52px' }}>
            🌿
          </div>
          <div style={{ fontSize: '76px', fontWeight: 700, color: '#7ad492', letterSpacing: '-2px' }}>ImbewuField</div>
        </div>
        <div style={{ fontSize: '44px', fontWeight: 600, lineHeight: 1.25, maxWidth: '900px' }}>
          Permaculture planning for South African farmers
        </div>
        <div style={{ fontSize: '30px', color: '#9bb29a', marginTop: '20px', maxWidth: '920px', lineHeight: 1.4 }}>
          Climate · soil · water · planting calendars · AI garden design — in your language
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '44px' }}>
          {['NASA POWER', 'ISRIC Soil', 'SANBI', 'Claude AI'].map((t) => (
            <div key={t} style={{ display: 'flex', fontSize: '22px', color: '#cfe0cd', padding: '8px 18px', borderRadius: '999px', background: 'rgba(22,37,20,0.7)', border: '1px solid rgba(72,168,100,0.3)' }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
