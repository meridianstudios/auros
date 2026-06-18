import { useState } from 'react';
import { ThemeProvider } from './theme/ThemeContext';
import { LocationsProvider } from './context/LocationsContext';
import type { View } from './nav';
import { Home } from './screens/Home';
import { Radar } from './screens/Radar';
import { Alerts } from './screens/Alerts';
import { Nwr } from './screens/Nwr';
import { Locations } from './screens/Locations';
import { Settings } from './screens/Settings';

const TABS: { key: View; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'radar', label: 'Radar', icon: '📡' },
  { key: 'alerts', label: 'Alerts', icon: '⚠️' },
  { key: 'nwr', label: 'NWR', icon: '📻' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

function Shell() {
  const [view, setView] = useState<View>('home');
  return (
    <div className="app">
      {view === 'home' && <Home onNavigate={setView} />}
      {view === 'radar' && <Radar />}
      {view === 'alerts' && <Alerts />}
      {view === 'nwr' && <Nwr />}
      {view === 'settings' && <Settings />}
      {view === 'locations' && <Locations />}

      <nav className="tabbar">
        {TABS.map((t) => {
          const active = view === t.key || (t.key === 'home' && view === 'locations');
          return (
            <button key={t.key} className={`tab ${active ? 'active' : ''}`} onClick={() => setView(t.key)}>
              <span className="ic">{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LocationsProvider>
        <Shell />
      </LocationsProvider>
    </ThemeProvider>
  );
}
