// Curated NOAA Weather Radio transmitters for SW Michigan / N Indiana.
// Status is curated (no clean live feed). Live outages: https://www.weather.gov/nwr/

export interface NwrStation {
  callSign: string;
  freqMHz: number | null;
  channel: string;
  location: string;
  lat: number;
  lon: number;
  counties: string;
  status: 'normal' | 'degraded' | 'unknown';
  recommended?: boolean;
  note?: string;
}

export const NWR_STATIONS: NwrStation[] = [
  {
    callSign: 'WXM (Plainwell)',
    freqMHz: 162.475,
    channel: 'WX4',
    location: 'Plainwell, MI',
    lat: 42.44,
    lon: -85.65,
    counties: 'Allegan, Berrien, Branch, Calhoun, Cass, Kalamazoo, St. Joseph, Van Buren +',
    status: 'normal',
    recommended: true,
    note: 'Best real-world signal for Branch County. Covers all SW Michigan with EAS alert activation.',
  },
  {
    callSign: 'Onondaga',
    freqMHz: 162.4,
    channel: 'WX1',
    location: 'Onondaga, MI',
    lat: 42.43,
    lon: -84.55,
    counties: 'Branch, Hillsdale, Ingham, Jackson, Eaton +',
    status: 'normal',
    note: 'Also covers Branch County with alert activation; wider Lansing/Jackson footprint.',
  },
  {
    callSign: 'WWG-45',
    freqMHz: 162.45,
    channel: 'WX3',
    location: 'North Webster, IN',
    lat: 41.32,
    lon: -85.7,
    counties: 'Northern Indiana + 5 SW Michigan counties (IWX office)',
    status: 'normal',
    note: 'IWX office transmitter — carries Branch County warnings, but weak/static at the MI line.',
  },
  {
    callSign: 'KIG76',
    freqMHz: 162.55,
    channel: 'WX7',
    location: 'Fort Wayne, IN',
    lat: 41.07,
    lon: -85.14,
    counties: 'NE Indiana (IWX area)',
    status: 'normal',
    note: 'Strong transmitter but ~55 mi out; typically out of range at the MI line.',
  },
  {
    callSign: 'KXI94',
    freqMHz: null,
    channel: '—',
    location: 'Angola, IN',
    lat: 41.63,
    lon: -84.99,
    counties: 'NE Indiana / S Michigan border',
    status: 'degraded',
    note: 'Closest transmitter, but flagged "Transmitting at Limited Range" — currently static.',
  },
];
