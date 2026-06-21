import L from 'leaflet';
import type { L3Data } from './decode';
import type { L3ProductDef } from './l3products';

// A Leaflet layer that renders decoded NEXRAD radials onto a canvas. Each radial
// is a 0.5–1° wedge from the radar; bins are colored by the product's scale and
// projected from polar (azimuth/range) to map pixels with a local planar approx
// around the radar (accurate enough over radar range, and fast — no per-bin
// geodesic projection). Color-runs are batched into single fills.

/* eslint-disable @typescript-eslint/no-explicit-any */
const RadialLayerClass = (L.Layer as any).extend({
  initialize(this: any, data: L3Data, product: L3ProductDef, opacity = 0.85) {
    this._data = data;
    this._product = product;
    this._opacity = opacity;
  },

  onAdd(this: any, map: L.Map) {
    this._map = map;
    const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = String(this._opacity);
    canvas.style.filter = 'blur(0.5px)'; // soften the gate/radial steps
    this._canvas = canvas;
    map.getPanes().overlayPane.appendChild(canvas);
    map.on('moveend zoomend resize', this._reset, this);
    this._reset();
    // The radar container can still be settling its flex size when the layer is
    // added; re-measure after layout so the canvas isn't sized to a stale value.
    requestAnimationFrame(() => this._reset());
    this._t = setTimeout(() => this._reset(), 250);
    return this;
  },

  onRemove(this: any, map: L.Map) {
    map.off('moveend zoomend resize', this._reset, this);
    if (this._t) clearTimeout(this._t);
    if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
    return this;
  },

  setData(this: any, data: L3Data, product: L3ProductDef) {
    this._data = data;
    this._product = product;
    if (this._map) this._reset();
  },

  _reset(this: any) {
    const map = this._map as L.Map;
    // Measure the container element directly — map.getSize() can be stale if the
    // radar pane resized after the map initialized.
    const container = map.getContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    this._canvas.width = w;
    this._canvas.height = h;
    this._draw(topLeft);
  },

  _draw(this: any, topLeft: L.Point) {
    const map = this._map as L.Map;
    const data = this._data as L3Data;
    const product = this._product as L3ProductDef;
    const ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    const radar = map.latLngToLayerPoint([data.radarLat, data.radarLon]);
    const cx = radar.x - topLeft.x;
    const cy = radar.y - topLeft.y;
    const mpp = (40075016.686 * Math.cos((data.radarLat * Math.PI) / 180)) / Math.pow(2, map.getZoom() + 8);
    const ppm = 1 / mpp;
    const gateM = data.gateKm * 1000;
    const firstM = data.firstBinKm * 1000;

    for (const radial of data.radials) {
      const bins = radial.bins;
      const n = bins.length;
      // resolve colors once per bin
      const colors: (string | null)[] = new Array(n);
      for (let i = 0; i < n; i += 1) {
        const v = bins[i];
        colors[i] = v == null ? null : product.color(v as number);
      }
      const a0 = (radial.startAngle * Math.PI) / 180;
      // Extend the trailing edge a touch past the next radial so adjacent wedges
      // overlap — removes the thin "spoke" seams between radials.
      const a1 = ((radial.startAngle + (radial.angleDelta || 1) + 0.6) * Math.PI) / 180;
      const sin0 = Math.sin(a0); const cos0 = Math.cos(a0);
      const sin1 = Math.sin(a1); const cos1 = Math.cos(a1);

      let j = 0;
      while (j < n) {
        const color = colors[j];
        if (color == null) { j += 1; continue; }
        let k = j + 1;
        while (k < n && colors[k] === color) k += 1;
        const rIn = firstM + j * gateM;
        const rOut = firstM + k * gateM;
        const xi0 = cx + rIn * sin0 * ppm; const yi0 = cy - rIn * cos0 * ppm;
        const xi1 = cx + rIn * sin1 * ppm; const yi1 = cy - rIn * cos1 * ppm;
        const xo1 = cx + rOut * sin1 * ppm; const yo1 = cy - rOut * cos1 * ppm;
        const xo0 = cx + rOut * sin0 * ppm; const yo0 = cy - rOut * cos0 * ppm;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(xi0, yi0);
        ctx.lineTo(xi1, yi1);
        ctx.lineTo(xo1, yo1);
        ctx.lineTo(xo0, yo0);
        ctx.closePath();
        ctx.fill();
        j = k;
      }
    }
  },
});

export function createRadialLayer(data: L3Data, product: L3ProductDef, opacity = 0.85): L.Layer {
  return new (RadialLayerClass as any)(data, product, opacity);
}
