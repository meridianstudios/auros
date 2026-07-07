import { useState, useEffect, lazy, Suspense } from 'react';
import { House, Radar as RadarIcon, TriangleAlert, RadioTower, Settings as SettingsIcon, Zap, MoreHorizontal, WifiOff } from 'lucide-react';
import { ThemeProvider } from './theme/ThemeContext';
import { LocationsProvider } from './context/LocationsContext';
import { PrefsProvider } from './lib/prefs';
import type { View } from './nav';
import { Home } from './screens/Home';
import { Alerts } from './screens/Alerts';
import { Nwr } from './screens/Nwr';
import { Locations } from './screens/Locations';
import { Settings } from './screens/Settings';
import { Forecast } from './screens/Forecast';
import { Drawer } from './components/Drawer';
import { SignIn } from './screens/SignIn';
import { AuthProvider } from './context/AuthContext';
import { AlertAlarm } from './components/AlertAlarm';

// Radar pulls in Leaflet — code-split it so it loads only when the tab opens.
const Radar = lazy(() => import('./screens/Radar').then((m) => ({ default: m.Radar })));
// Auros Live is a full-screen broadcast mode — code-split it too.
const AurosLive = lazy(() => import('./screens/AurosLive').then((m) => ({ default: m.AurosLive })));

const TABS: { key: View; label: string; Icon: typeof House }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'radar', label: 'Radar', Icon: RadarIcon },
  { key: 'alerts', label: 'Alerts', Icon: TriangleAlert },
  { key: 'nwr', label: 'Radio', Icon: RadioTower },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

function Shell() {
  const [view, setView] = useState<View>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = () => setMenuOpen(true);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  // Auros Live takes over the whole screen (no tab bar). Keep AlertAlarm mounted
  // so a new warning still breaks in with the box + tone even while broadcasting.
  if (view === 'live') {
    // Auros Live handles its own alert box + Weatherscan beeps, so AlertAlarm is
    // not mounted here (avoids a duplicate box + tone over the broadcast).
    return (
      <Suspense fallback={<div className="center" style={{ position: 'fixed', inset: 0 }}><div className="spin" /></div>}>
        <AurosLive onExit={() => setView('home')} />
      </Suspense>
    );
  }

  const screen =
    view === 'home' ? <Home onNavigate={setView} />
    : view === 'radar' ? <Radar />
    : view === 'alerts' ? <Alerts />
    : view === 'nwr' ? <Nwr />
    : view === 'settings' ? <Settings />
    : view === 'locations' ? <Locations />
    : view === 'forecast' ? <Forecast />
    : view === 'signin' ? <SignIn onNavigate={setView} />
    : <Home onNavigate={setView} />;

  return (
    <div className="app">
      {!online && <div className="offline-banner"><WifiOff size={13} /> You're offline — showing the latest saved data</div>}
      <button className="menu-fab" aria-label="Menu" onClick={openMenu}><MoreHorizontal size={20} /></button>
      <main className="main">
        <Suspense fallback={<div className="center"><div className="spin" /></div>}>{screen}</Suspense>
      </main>
      <nav className="tabbar">
        <div className="nav-brand"><Zap size={19} /> Auros</div>
        {TABS.map(({ key, label, Icon }) => {
          const active = view === key || (key === 'home' && (view === 'locations' || view === 'forecast'));
          return (
            <button key={key} className={`tab ${active ? 'active' : ''}`} onClick={() => setView(key)}>
              <Icon size={21} />
              {label}
            </button>
          );
        })}
      </nav>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={setView} />
      <AlertAlarm />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PrefsProvider>
          <LocationsProvider>
            <Shell />
          </LocationsProvider>
        </PrefsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
