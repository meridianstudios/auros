// Temperature (°F) → color, shared by the hourly graph and the 7-day range bars
// so the whole home screen reads as one system: deep blue on the cold end,
// warming through cyan/green/yellow to orange and red on the hot end. Absolute
// scale, so a cold day reads all-blue and a hot day all-red.
const TEMP_STOPS: [number, number, number, number][] = [
  [-10, 124, 92, 214], // violet (brutal cold)
  [10, 79, 110, 220], // deep blue
  [25, 70, 150, 233], // blue
  [35, 56, 189, 248], // cyan
  [48, 45, 212, 160], // teal
  [60, 122, 200, 60], // green
  [70, 245, 200, 40], // yellow
  [80, 250, 150, 55], // orange
  [90, 244, 105, 45], // deep orange
  [102, 235, 66, 66], // red
];

export function tempColor(f: number): string {
  const s = TEMP_STOPS;
  if (f <= s[0][0]) return `rgb(${s[0][1]},${s[0][2]},${s[0][3]})`;
  const last = s[s.length - 1];
  if (f >= last[0]) return `rgb(${last[1]},${last[2]},${last[3]})`;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (f >= a[0] && f <= b[0]) {
      const k = (f - a[0]) / (b[0] - a[0]);
      return `rgb(${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)},${Math.round(a[3] + (b[3] - a[3]) * k)})`;
    }
  }
  return `rgb(${last[1]},${last[2]},${last[3]})`;
}
