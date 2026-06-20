import type { CSSProperties } from 'react';
import { TriangleAlert, Radar, ChevronRight } from 'lucide-react';
import { severityColor } from '../theme/colors';
import { formatTime } from '../utils/format';
import type { NwsAlert } from '../api/nws';
import type { View } from '../nav';

// Prominent alert-first banner shown at the top of Home when a warning is active
// for the selected location — what it is, until when, what to do, quick actions.
export function SevereBanner({ alert, onNavigate }: { alert: NwsAlert; onNavigate: (v: View) => void }) {
  const color = severityColor(alert.severity, alert.event);
  const until = alert.ends ? `Until ${formatTime(alert.ends)}` : null;
  const instruction = (alert.instruction || alert.headline || '').split('\n')[0];
  return (
    <div className="severe-banner" style={{ ['--sev' as string]: color } as CSSProperties}>
      <div className="sb-top">
        <span className="sb-ic"><TriangleAlert size={20} /></span>
        <div className="grow">
          <div className="sb-event">{alert.event}</div>
          {until && <div className="sb-until">{until}</div>}
        </div>
      </div>
      {instruction && <div className="sb-instr">{instruction}</div>}
      <div className="sb-actions">
        <button className="sb-btn" onClick={() => onNavigate('radar')}><Radar size={15} /> Radar</button>
        <button className="sb-btn ghost" onClick={() => onNavigate('alerts')}>Details <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}
