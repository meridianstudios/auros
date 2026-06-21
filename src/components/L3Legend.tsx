import { type L3ProductDef, legendGradient } from '../lib/nexradL3/l3products';

// Color-scale legend for the active Level 3 product: a gradient bar with axis
// labels for continuous products, or labeled swatches for categorical ones.
export function L3Legend({ def }: { def: L3ProductDef }) {
  return (
    <div className="l3-legend">
      {def.categories ? (
        <div className="l3-legend-cats">
          {def.categories.map((c) => (
            <span key={c.label} className="l3-cat">
              <i style={{ background: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      ) : def.scale ? (
        <>
          <div className="l3-legend-bar" style={{ background: legendGradient(def) }} />
          <div className="l3-legend-axis">
            {def.scale.labels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        </>
      ) : null}
      <div className="l3-legend-cap">{def.legend} · tap a dot to switch radar</div>
    </div>
  );
}
