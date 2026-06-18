// RainViewer public API — free reflectivity radar tile frames.

export interface RadarFrame {
  time: number;
  path: string;
  nowcast: boolean;
}

export interface RadarData {
  host: string;
  frames: RadarFrame[];
}

export async function getRadar(): Promise<RadarData> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const data = await res.json();
  const past: RadarFrame[] = (data.radar?.past ?? []).map((f: any) => ({
    time: f.time, path: f.path, nowcast: false,
  }));
  const nowcast: RadarFrame[] = (data.radar?.nowcast ?? []).map((f: any) => ({
    time: f.time, path: f.path, nowcast: true,
  }));
  return { host: data.host, frames: [...past, ...nowcast] };
}
