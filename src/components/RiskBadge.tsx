import type { RiskMeta } from '../theme/colors';

export function RiskBadge({ risk, error }: { risk: RiskMeta | null; error?: boolean }) {
  if (error) {
    return (
      <div className="risk-none">
        <span className="dot" style={{ background: 'var(--warning)' }} />
        <span>
          Outlook unavailable in browser ·{' '}
          <a href="https://www.spc.noaa.gov/products/outlook/day1otlk.html" target="_blank" rel="noreferrer">
            view on SPC
          </a>
        </span>
      </div>
    );
  }
  if (!risk) {
    return (
      <div className="risk-none">
        <span className="dot" style={{ background: 'var(--success)' }} />
        <span>No severe risk today</span>
      </div>
    );
  }
  return (
    <div className="risk" style={{ background: risk.color, color: risk.textOn }}>
      <div className="full">{risk.full}</div>
      <div className="sub">SPC Day 1 Convective Outlook</div>
    </div>
  );
}
