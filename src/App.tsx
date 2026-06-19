import { useState } from 'react';
import { House, Radar as RadarIcon, TriangleAlert, RadioTower, Settings as SettingsIcon, CloudSun } from 'lucide-react';
import { ThemeProvider } from './theme/ThemeContext';
import { LocationsProvider } from './context/LocationsContext';
import { PrefsProvider } from './lib/prefs';
import type { View } from './nav';
import { Home } from './screens/Home';
import { Radar } from './screens/Radar';
import { Alerts } from './screens/Alerts';
import { Nwr } from './screens/Nwr';
import { Locations } from './screens/Locations';
import { Settings } from './screens/Settings';
import { Forecast } from './screens/Forecast';
import { Drawer } from './components/Drawer';

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

  const screen =
    view === 'home' ? <Home onNavigate={setView} onMenu={openMenu} />
    : view === 'radar' ? <Radar />
    : view === 'alerts' ? <Alerts />
    : view === 'nwr' ? <Nwr />
    : view === 'settings' ? <Settings />
    : view === 'locations' ? <Locations />
    : view === 'forecast' ? <Forecast />
    : <Home onNavigate={setView} onMenu={openMenu} />;

  return (
    <div className="app">
      <main className="main">{screen}</main>
      <nav className="tabbar">
        <div className="nav-brand"><CloudSun size={20} /> Nova Weather</div>
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
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <LocationsProvider>
          <Shell />
        </LocationsProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}
