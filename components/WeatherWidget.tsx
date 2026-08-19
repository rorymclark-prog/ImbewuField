'use client';

import { useEffect, useState } from 'react';
import { Wind, Snowflake, Flame, CloudRain, Droplets } from 'lucide-react';
import { fetchWeatherForecast, describeWeatherCode, type WeatherForecast } from '@/lib/weather';
import { getElementArt2 } from '@/lib/element-art-2';

interface Props {
  lat: number;
  lon: number;
  compact?: boolean; // tighter spacing + shorter forecast strip for the home-hub mount
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "2026-07-16" -> "Fri" — parsed as a plain calendar date (no time component)
// so it can't drift a day off in either direction from the browser's TZ.
function dayLabel(isoDate: string, index: number): string {
  if (index === 0) return 'Today';
  const [y, m, d] = isoDate.split('-').map(Number);
  return DAY_LABELS[new Date(y, m - 1, d).getDay()];
}

export default function WeatherWidget({ lat, lon, compact = false }: Props) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchWeatherForecast(lat, lon).then((result) => {
      if (cancelled) return;
      if (result) {
        setForecast(result);
        setStatus('ok');
      } else {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  if (status === 'error') {
    return (
      <div
        className="font-sans rounded-2xl px-3.5 py-2.5"
        style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', fontSize: 12, color: '#94876F' }}
      >
        Weather unavailable right now — showing site climate data below instead.
      </div>
    );
  }

  if (status === 'loading' || !forecast) {
    return (
      <div
        className="rounded-2xl px-3.5 py-3 animate-pulse"
        style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', height: 88 }}
      />
    );
  }

  const { current, daily } = forecast;
  const currentDesc = describeWeatherCode(current.weatherCode);
  const today = daily[0];

  const frostDays = daily.filter((d) => d.frostWarning);
  const heatDays = daily.filter((d) => d.heatWarning);
  const rainDays = daily.filter((d) => d.heavyRainWarning);
  const stripDays = compact ? daily.slice(0, 4) : daily;

  return (
    <div className="space-y-2">
      {/* Hazard banners — the actual value: buried numbers turned into a plain warning */}
      {frostDays.length > 0 && (
        <HazardBanner
          icon={<Snowflake size={16} style={{ color: '#235E86' }} />}
          bg="rgba(35,94,134,0.10)"
          border="rgba(35,94,134,0.3)"
          color="#235E86"
          text={`Frost expected ${frostDays.map((d, i) => dayLabel(d.date, daily.indexOf(d))).join(', ')} — protect seedlings`}
        />
      )}
      {heatDays.length > 0 && (
        <HazardBanner
          icon={<Flame size={16} style={{ color: '#B83A18' }} />}
          bg="rgba(184,58,24,0.10)"
          border="rgba(184,58,24,0.3)"
          color="#B83A18"
          text={`Heat warning ${heatDays.map((d) => dayLabel(d.date, daily.indexOf(d))).join(', ')} — water early morning, shade seedlings`}
        />
      )}
      {rainDays.length > 0 && (
        <HazardBanner
          icon={<CloudRain size={16} style={{ color: '#235E86' }} />}
          bg="rgba(35,94,134,0.10)"
          border="rgba(35,94,134,0.3)"
          color="#235E86"
          text={`Heavy rain expected ${rainDays.map((d) => dayLabel(d.date, daily.indexOf(d))).join(', ')} — check drainage, delay planting`}
        />
      )}

      {/* Current conditions + today's irrigation hint */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
        <div className="flex items-center gap-2.5 px-3.5 py-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
          {getElementArt2(currentDesc.key) ? (
            <img
              src={getElementArt2(currentDesc.key)}
              alt=""
              aria-hidden
              style={{ width: compact ? 26 : 30, height: compact ? 26 : 30, objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: compact ? 26 : 30, lineHeight: 1 }}>{currentDesc.icon}</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold" style={{ fontSize: compact ? 16 : 18, color: '#20190F', lineHeight: 1.1 }}>
              {Math.round(current.tempC)}°C
            </div>
            <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{currentDesc.label}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" style={{ color: '#94876F' }}>
            <Wind size={14} />
            <span className="font-sans" style={{ fontSize: 12 }}>{Math.round(current.windKph)} km/h</span>
          </div>
        </div>

        {today.et0Mm !== null && (
          <div className="flex items-center gap-2 px-3.5 py-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
            <Droplets size={14} style={{ color: '#235E86', flexShrink: 0 }} />
            <span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
              Crops will lose about <span className="font-semibold" style={{ color: '#20190F' }}>{today.et0Mm.toFixed(1)}mm</span> of water today — water roughly that much if there's no rain
            </span>
          </div>
        )}

        {/* Forecast strip — full 7 days, or first 4 in compact mode */}
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {stripDays.map((d, i) => {
            const desc = describeWeatherCode(d.weatherCode);
            return (
              <div
                key={d.date}
                className="flex flex-col items-center flex-shrink-0 px-2 py-2"
                style={{ minWidth: 58, borderRight: i < stripDays.length - 1 ? '1px solid #F0E9D8' : 'none' }}
              >
                <div className="font-sans font-medium" style={{ fontSize: 10.5, color: '#94876F' }}>{dayLabel(d.date, i)}</div>
                {getElementArt2(desc.key) ? (
                  <img src={getElementArt2(desc.key)} alt="" aria-hidden style={{ width: 23, height: 23, margin: '1px 0' }} />
                ) : (
                  <div style={{ fontSize: 23, lineHeight: 1.2 }}>{desc.icon}</div>
                )}
                <div className="font-display" style={{ fontSize: 13, color: '#20190F' }}>
                  <span className="font-semibold">{Math.round(d.tMaxC)}°</span>
                  <span style={{ color: '#94876F' }}> {Math.round(d.tMinC)}°</span>
                </div>
                <div className="font-sans" style={{ fontSize: 10, color: d.precipMm > 0 ? '#235E86' : '#C4BAA4', marginTop: 2 }}>
                  {d.precipMm > 0 ? `${d.precipMm.toFixed(0)}mm` : '—'}
                  {d.precipProbability !== null && d.precipProbability > 0 ? ` · ${d.precipProbability}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HazardBanner({ icon, bg, border, color, text }: { icon: React.ReactNode; bg: string; border: string; color: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
      <span className="flex-shrink-0">{icon}</span>
      <span className="font-sans font-medium" style={{ fontSize: 12, color }}>{text}</span>
    </div>
  );
}
