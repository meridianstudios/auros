import { ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { NwsAlert } from '../api/nws';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';
import { alertIcon, alertTier } from '../lib/alertMeta';

export function AlertCard({ alert, onClick }: { alert: NwsAlert; onClick?: () => void }) {
  const accent = severityColor(alert.severity, alert.event);
  const Icon = alertIcon(alert.event);
  return (
    <button className="alert-card alert-card-head" style={{ '--accent': accent } as CSSProperties} onClick={onClick}>
      <span className="alert-card-ic"><Icon size={20} /></span>
      <div className="grow">
        <div className="alert-card-top">
          <span className="alert-card-event">{alert.event}</span>
          <span className="alert-card-tier">{alertTier(alert.event)}</span>
        </div>
        {alert.headline && <div className="alert-card-headline">{alert.headline}</div>}
        <div className="alert-card-meta">{alert.ends ? `Until ${formatDayTime(alert.ends)}` : alert.areaDesc}</div>
      </div>
      {onClick && <ChevronRight size={18} className="chev" />}
    </button>
  );
}
