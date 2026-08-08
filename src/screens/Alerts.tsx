import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { useLsr } from '../hooks/useLsr';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';
import { haversineMiles } from '../utils/geo';
import { alertIcon, alertTier, alertRank, lsrIcon, lsrLabel, lsrColor } from '../lib/alertMeta';

// Short "3h ago" recency for storm reports.
function agoShort(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function Alerts() {
  const { selected } = useLocations();
  const w = useWeather(selected.lat, selected.lon);
  const lsr = useLsr(selected.lat, selected.lon);
  const [open, setOpen] = useState<string | null>(null);

  // Loudest hazards first (tornado/severe warnings → watches → advisories).
  const alerts = [...w.alerts].sort((a, b) => alertRank(b.event) - alertRank(a.event));
  const reports = lsr.lsrs.slice(0, 25);

  return (
    <div className="view fade">
      <div className="topbar">
        <h1>Alerts</h1>
        <p>{selected.name}{alerts.length ? ` · ${alerts.length} active` : ''}</p>
      </div>
      <div className="pad">
        {w.loading && alerts.length === 0 ? (
          <div className="center"><div className="spin" /></div>
        ) : alerts.length === 0 ? (
          <div className="allclear">
            <span className="allclear-ic"><ShieldCheck size={26} /></span>
            <div className="allclear-t">All clear</div>
            <div className="allclear-s">No watches, warnings, or advisories for {selected.name}.</div>
          </div>
        ) : (
          alerts.map((a) => {
            const accent = severityColor(a.severity, a.event);
            const Icon = alertIcon(a.event);
            const isOpen = open === a.id;
            return (
              <div className="alert-card" style={{ '--accent': accent } as CSSProperties} key={a.id}>
                <button className="alert-card-head" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen}>
                  <span className="alert-card-ic"><Icon size={22} /></span>
                  <div className="grow">
                    <div className="alert-card-top">
                      <span className="alert-card-event">{a.event}</span>
                      <span className="alert-card-tier">{alertTier(a.event)}</span>
                    </div>
                    {a.headline && <div className="alert-card-headline">{a.headline}</div>}
                    <div className="alert-card-meta">{a.areaDesc}{a.ends ? ` · until ${formatDayTime(a.ends)}` : ''}</div>
                  </div>
                  <ChevronDown size={18} className={`chev alert-card-chev${isOpen ? ' open' : ''}`} />
                </button>
                {isOpen && (
                  <div className="alert-body">
                    {a.description?.trim()}
                    {a.instruction ? `\n\n${a.instruction.trim()}` : ''}
                  </div>
                )}
              </div>
            );
          })
        )}

        {reports.length > 0 && (
          <>
            <div className="label">Recent Storm Reports</div>
            {reports.map((l) => {
              const Icon = lsrIcon(l.typetext);
              const color = lsrColor(l.typetext);
              const dist = Math.round(haversineMiles(selected.lat, selected.lon, l.lat, l.lon));
              return (
                <div className="lsr-item" key={l.id}>
                  <span className="lsr-ic" style={{ color }}><Icon size={18} /></span>
                  <div className="grow">
                    <div className="lsr-title">{lsrLabel(l.typetext, l.magf, l.unit)}</div>
                    <div className="lsr-meta">{l.city}{l.state ? `, ${l.state}` : ''} · {dist} mi · {agoShort(l.valid)}</div>
                    {l.remark && <div className="lsr-remark">{l.remark}</div>}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div className="alert-src">National Weather Service · api.weather.gov · IEM</div>
      </div>
    </div>
  );
}
