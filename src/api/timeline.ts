// Storm-approach timeline: scan the NWS hourly forecast for a thunderstorm window.

import type { NwsPeriod } from './nws';

export interface StormWindow {
  startIso: string;
  endIso: string;
  peakIso: string;
  peakPop: number; // % probability of precip at the peak hour
}

const isStormy = (p: NwsPeriod) => /t-?storm|thunder/i.test(p.shortForecast || '');

export function analyzeStormTimeline(periods: NwsPeriod[]): StormWindow | null {
  const next = periods.slice(0, 24);
  const first = next.findIndex(isStormy);
  if (first === -1) return null;

  // Extend the window forward, tolerating gaps up to 2 hours.
  let last = first;
  for (let i = first; i < next.length; i++) {
    if (isStormy(next[i])) last = i;
    else if (i - last > 2) break;
  }

  let peakIdx = first;
  let peakPop = 0;
  for (let i = first; i <= last; i++) {
    const pop = next[i].probabilityOfPrecipitation?.value ?? 0;
    if (pop >= peakPop) { peakPop = pop; peakIdx = i; }
  }

  return {
    startIso: next[first].startTime,
    endIso: next[last].startTime,
    peakIso: next[peakIdx].startTime,
    peakPop,
  };
}
