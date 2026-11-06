/** Synthetic provider-shaped data; not a real property, yield or investment claim. */
export function pvgisFixture() {
  return {
    inputs: {
      location: { latitude: 45, longitude: 8 },
      meteo_data: { radiation_db: 'fixture-radiation', meteo_db: 'fixture-weather', year_min: 2005, year_max: 2023, use_horizon: true },
      mounting_system: { fixed: { slope: { value: 35, optimal: true }, azimuth: { value: 0, optimal: true }, type: 'free-standing' } },
      pv_module: { technology: 'c-Si', peak_power: 1, system_loss: 14 },
    },
    outputs: { monthly: { fixed: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_m: 100, 'H(i)_m': 150 })) }, totals: { fixed: { E_y: 1200, 'H(i)_y': 1800 } } },
    meta: { outputs: { totals: { variables: { E_y: { units: 'kWh/y' }, 'H(i)_y': { units: 'kWh/m2/y' } } },
      monthly: { variables: { E_m: { units: 'kWh/mo' }, 'H(i)_m': { units: 'kWh/m2/mo' } } } } },
  };
}

/** Isolated test-only device clock; never changes the host clock or provider timestamp. */
export function withDeviceClock<T>(iso: string, run: () => T): T {
  const RealDate = Date;
  const fixed = RealDate.parse(iso);
  class DeviceDate extends RealDate {
    constructor(...args: any[]) { if (args.length) super(...(args as [any])); else super(fixed); }
    static now() { return fixed; }
  }
  globalThis.Date = DeviceDate as DateConstructor;
  try { return run(); } finally { globalThis.Date = RealDate; }
}
