import { ChevronRight } from 'lucide-react';
import type { NwsAlert } from '../api/nws';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';

export function AlertCard({ alert, onClick }: { alert: NwsAlert; onClick?: () => void }) {
  const accent = severityColor(alert.severity, alert.event);
  return (
    <button className="card" style={{ display: 'flex', gap: 14, width: '100%', textAlign: 'left', alignItems: 'center' }} onClick={onClick}>
      <div className="alert-accent" style={{ background: accent }} />
      <div className="grow">
        <div style={{ fontWeight: 600, color: accent }}>{alert.event}</div>
        {alert.headline && (
          <div className="muted" style={{ fontSize: 13, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {alert.headline}
          </div>
        )}
        <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
          {alert.ends ? `Until ${formatDayTime(alert.ends)}` : alert.areaDesc}
        </div>
      </div>
      {onClick && <ChevronRight size={18} className="chev" />}
    </button>
  );
}
