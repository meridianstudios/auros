import type { NwsAlert } from '../api/nws';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';

export function AlertCard({ alert, onClick }: { alert: NwsAlert; onClick?: () => void }) {
  const accent = severityColor(alert.severity, alert.event);
  return (
    <div className="card alert" style={{ borderLeftColor: accent, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="ev" style={{ color: accent }}>{alert.event}</span>
        {alert.severity && <span className="muted" style={{ fontSize: 11, fontWeight: 700 }}>{alert.severity.toUpperCase()}</span>}
      </div>
      {alert.headline && <div style={{ marginTop: 6 }}>{alert.headline}</div>}
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {alert.ends ? `Until ${formatDayTime(alert.ends)}` : alert.areaDesc}
      </div>
    </div>
  );
}
