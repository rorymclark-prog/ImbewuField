'use client';

import { useEffect, useState } from 'react';
import { Wind, Snowflake, Flame, CloudRain, Droplets } from 'lucide-react';
import { fetchWeatherForecast, describeWeatherCode, type WeatherForecast } from '@/lib/weather';
import { getElementArt2 } from '@/lib/element-art-2';
import { useLanguage } from '@/lib/i18n';
import IsiZuluDraftSource from './IsiZuluDraftSource';
import { fillWeather, weatherDayKey, weatherDescKey, weatherEnglish, weatherText } from '@/lib/weather-copy';

interface Props {
  lat: number;
  lon: number;
  compact?: boolean; // tighter spacing + shorter forecast strip for the home-hub mount
  /**
   * ux-15: Home has nothing climate-related below this card, so its fallback can't promise "site
   * climate data below instead" — only the /farmer site-report mount (DataPanel, the default) has
   * that content following it.
   */
  context?: 'home' | 'report';
}

// "2026-07-16" -> weekday index — parsed as a plain calendar date (no time component)
// so it can't drift a day off in either direction from the browser's TZ.
function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// The label for one forecast day in `lang` (isiZulu draft or English); index 0 is "Today".
function dayLabel(lang: string, isoDate: string, index: number): string {
  return weatherText(lang, weatherDayKey(weekdayOf(isoDate), index === 0));
}

export default function WeatherWidget({ lat, lon, compact = false, context = 'report' }: Props) {
  const { lang } = useLanguage();
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
    const english = context === 'home'
      ? 'Weather is not available right now.'
      : 'Weather unavailable right now — showing site climate data below instead.';
    const zulu = context === 'home'
      ? 'Isimo sezulu asitholakali okwamanje.'
      : 'Isimo sezulu asitholakali okwamanje — imininingwane yesimo sezulu yendawo iboniswa ngezansi.';
    return (
      <div
        className="font-sans rounded-2xl px-3.5 py-2.5"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}
      >
        <IsiZuluDraftSource lang={lang} zulu={zulu} english={english} />
      </div>
    );
  }

  if (status === 'loading' || !forecast) {
    return (
      <div
        className="rounded-2xl px-3.5 py-3 animate-pulse"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', height: 88 }}
      />
    );
  }

  const { current, daily } = forecast;
  const currentDesc = describeWeatherCode(current.weatherCode);
  const today = daily[0];
  const zu = lang === 'zu';
  const daysIn = (l: string, list: typeof daily) => list.map((d) => dayLabel(l, d.date, daily.indexOf(d))).join(', ');
  const hazardText = (key: string, list: typeof daily) => ({
    text: fillWeather(weatherText(lang, key), { days: daysIn(lang, list) }),
    english: fillWeather(weatherEnglish(key), { days: daysIn('en', list) }),
  });

  const frostDays = daily.filter((d) => d.frostWarning);
  const heatDays = daily.filter((d) => d.heatWarning);
  const rainDays = daily.filter((d) => d.heavyRainWarning);
  const stripDays = compact ? daily.slice(0, 4) : daily;

  return (
    <div className="space-y-2">
      {/* Hazard banners — the actual value: buried numbers turned into a plain warning */}
      {frostDays.length > 0 && (
        <HazardBanner
          icon={<Snowflake size={16} style={{ color: 'var(--blue)' }} />}
          tone="blue"
          {...hazardText('weatherFrostBanner', frostDays)} lang={lang}
        />
      )}
      {heatDays.length > 0 && (
        <HazardBanner
          icon={<Flame size={16} style={{ color: 'var(--orange)' }} />}
          tone="orange"
          {...hazardText('weatherHeatBanner', heatDays)} lang={lang}
        />
      )}
      {rainDays.length > 0 && (
        <HazardBanner
          icon={<CloudRain size={16} style={{ color: 'var(--blue)' }} />}
          tone="blue"
          {...hazardText('weatherHeavyRainBanner', rainDays)} lang={lang}
        />
      )}

      {/* Current conditions + today's irrigation hint */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 px-3.5 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
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
            <div className="font-display font-bold" style={{ fontSize: compact ? 16 : 18, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {Math.round(current.tempC)}°C
            </div>
            <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{zu ? <DescLabel lang={lang} label={currentDesc.label} /> : currentDesc.label}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            <Wind size={14} />
            <span className="font-sans" style={{ fontSize: 12 }}>{Math.round(current.windKph)} km/h</span>
          </div>
        </div>

        {today.et0Mm !== null && (
          <div className="flex items-center gap-2 px-3.5 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <Droplets size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
            <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {zu ? (
                <IsiZuluDraftSource
                  lang={lang}
                  zulu={fillWeather(weatherText(lang, 'weatherWaterLoss'), { mm: today.et0Mm.toFixed(1) })}
                  english={fillWeather(weatherEnglish('weatherWaterLoss'), { mm: today.et0Mm.toFixed(1) })}
                />
              ) : (
                <>Crops will lose about <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{today.et0Mm.toFixed(1)}mm</span> of water today — water roughly that much if there's no rain</>
              )}
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
                style={{ minWidth: 58, borderRight: i < stripDays.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div className="font-sans font-medium" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dayLabel(lang, d.date, i)}</div>
                {getElementArt2(desc.key) ? (
                  <img src={getElementArt2(desc.key)} alt="" aria-hidden style={{ width: 23, height: 23, margin: '1px 0' }} />
                ) : (
                  <div style={{ fontSize: 23, lineHeight: 1.2 }}>{desc.icon}</div>
                )}
                <div className="font-display" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <span className="font-semibold">{Math.round(d.tMaxC)}°</span>
                  <span style={{ color: 'var(--text-muted)' }}> {Math.round(d.tMinC)}°</span>
                </div>
                <div className="font-sans" style={{ fontSize: 12, color: d.precipMm > 0 ? 'var(--blue)' : 'var(--text-muted)', marginTop: 2 }}>
                  {d.precipMm > 0 ? `${d.precipMm.toFixed(0)}mm` : (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only" lang={zu ? 'zu' : undefined}>{weatherText(lang, 'weatherNoRain')}</span>
                    </>
                  )}
                  {d.precipProbability !== null && d.precipProbability > 0 ? ` · ${d.precipProbability}%` : ''}
                </div>
              </div>
            );
          })}
        </div>
        {zu && (
          <p className="font-sans" style={{ margin: 0, padding: '6px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Unreviewed isiZulu draft. <span lang="en">English source for the days: {[0, 1, 2, 3, 4, 5, 6].map((n) => weatherEnglish(weatherDayKey(n, false))).join(', ')}; Today.</span>
          </p>
        )}
      </div>
    </div>
  );
}

function DescLabel({ lang, label }: { lang: string; label: string }) {
  const key = weatherDescKey(label);
  if (!key) return <>{label}</>;
  return <IsiZuluDraftSource lang={lang} zulu={weatherText(lang, key)} english={label} />;
}

function HazardBanner({ icon, tone, text, english, lang }: { icon: React.ReactNode; tone: 'blue' | 'orange'; text: string; english: string; lang: string }) {
  const c = `var(--${tone})`;
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
      style={{
        background: `color-mix(in srgb, ${c} 10%, var(--bg-1))`,
        border: `1px solid color-mix(in srgb, ${c} 30%, var(--bg-1))`,
      }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="font-sans font-medium" style={{ fontSize: 12, color: c }}>
        <IsiZuluDraftSource lang={lang} zulu={lang === 'zu' ? text : ''} english={english} />
      </span>
    </div>
  );
}
