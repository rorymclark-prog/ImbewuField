// Live weather forecast (current + 7-day) from Open-Meteo's Forecast API.
//
// This is deliberately a separate endpoint/module from lib/nasa-power.ts's
// fetchOpenMeteoRainfall: that one hits the *archive* API for 30-year
// historical climate normals (backward-looking). This one hits the
// *forecast* API for the next 16 days (forward-looking) — same provider,
// different product, both free+keyless.
//
// LICENSE: Open-Meteo's free tier is non-commercial use only. Fine for the
// current private/dev stage; a paid tier (~$29/mo) is needed before any
// public/commercial launch.

export interface CurrentWeather {
  tempC: number;
  weatherCode: number;
  windKph: number;
}

export interface DailyForecast {
  /** ISO date, e.g. "2026-07-16" */
  date: string;
  tMaxC: number;
  tMinC: number;
  precipMm: number;
  /** 0-100, or null if the upstream model didn't return one */
  precipProbability: number | null;
  windMaxKph: number;
  weatherCode: number;
  /** Reference evapotranspiration in mm, or null if unavailable */
  et0Mm: number | null;
  frostWarning: boolean;
  heatWarning: boolean;
  heavyRainWarning: boolean;
}

export interface WeatherForecast {
  current: CurrentWeather;
  daily: DailyForecast[];
}

const FROST_TMIN_C = 2;
const HEAT_TMAX_C = 35;
const HEAVY_RAIN_MM = 25;

/**
 * Fetch current conditions + next-7-days forecast for a point.
 * Returns null on any failure — caller must degrade gracefully (this powers
 * a widget that must never block or break the page).
 */
export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecast | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set(
      'daily',
      [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'windspeed_10m_max',
        'weathercode',
        'et0_fao_evapotranspiration',
      ].join(',')
    );
    url.searchParams.set('windspeed_unit', 'kmh');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const json = await res.json();
    const cw = json.current_weather;
    const d = json.daily;
    if (!cw || !d?.time?.length) return null;

    const daily: DailyForecast[] = d.time.map((date: string, i: number) => {
      const tMinC = d.temperature_2m_min?.[i] ?? null;
      const tMaxC = d.temperature_2m_max?.[i] ?? null;
      const precipMm = d.precipitation_sum?.[i] ?? 0;
      if (tMinC === null || tMaxC === null) return null;
      return {
        date,
        tMaxC,
        tMinC,
        precipMm,
        precipProbability: d.precipitation_probability_max?.[i] ?? null,
        windMaxKph: d.windspeed_10m_max?.[i] ?? 0,
        weatherCode: d.weathercode?.[i] ?? 0,
        et0Mm: d.et0_fao_evapotranspiration?.[i] ?? null,
        frostWarning: tMinC <= FROST_TMIN_C,
        heatWarning: tMaxC >= HEAT_TMAX_C,
        heavyRainWarning: precipMm >= HEAVY_RAIN_MM,
      };
    }).filter((x: DailyForecast | null): x is DailyForecast => x !== null);

    if (daily.length === 0) return null;

    return {
      current: {
        tempC: cw.temperature,
        weatherCode: cw.weathercode,
        windKph: cw.windspeed,
      },
      daily,
    };
  } catch {
    return null;
  }
}

/**
 * WMO weather-interpretation codes (the set Open-Meteo uses) collapsed to a
 * plain-English label + emoji glyph. Deliberately coarse — farmers need
 * "rain" not "slight intermittent drizzle at moderate intensity".
 */
export function describeWeatherCode(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear', icon: '☀️' };
  if (code <= 2) return { label: 'Partly cloudy', icon: '🌤️' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: '🌧️' };
  if (code >= 85 && code <= 86) return { label: 'Snow showers', icon: '🌨️' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Unsettled', icon: '🌥️' };
}
