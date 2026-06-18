import type { RiskMeta } from '../theme/colors';

export function RiskBadge({ risk, error }: { risk: RiskMeta | null; error?: boolean }) {
  if (error) {
    return (
      <div className="risk">
        <div className="swatch" style={{ background: 'var(--warning)' }} />
        <div>
          <div className="lvl">Outlook unavailable</div>
          <div className="src">
            <a href="https://www.spc.noaa.gov/products/outlook/day1otlk.html" target="_blank" rel="noreferrer">View on SPC ↗</a>
          </div>
        </div>
      </div>
    );
  }
  if (!risk) {
    return (
      <div className="risk">
        <div className="swatch" style={{ background: 'var(--success)' }} />
        <div>
          <div className="lvl">No severe risk</div>
          <div className="src">SPC Day 1 Convective Outlook</div>
        </div>
      </div>
    );
  }
  return (
    <div className="risk">
      <div className="swatch" style={{ background: risk.color }} />
      <div>
        <div className="lvl">{risk.full} Risk</div>
        <div className="src">SPC Day 1 Outlook · Level {risk.level}/5</div>
      </div>
    </div>
  );
}
