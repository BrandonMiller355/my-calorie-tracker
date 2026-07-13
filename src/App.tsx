import { NavLink, Route, Routes } from 'react-router-dom';
import { DayLogScreen } from './screens/DayLogScreen';
import { FoodsScreen } from './screens/FoodsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppProvider } from './state/AppState';
import type { StorageRepository } from './storage';

const ICON_PROPS = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const LogIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const SearchIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const FoodsIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="7.5" cy="7.5" r="2.6" />
    <circle cx="16.5" cy="7.5" r="2.6" />
    <circle cx="7.5" cy="16.5" r="2.6" />
    <circle cx="16.5" cy="16.5" r="2.6" />
  </svg>
);

const SettingsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="1.9" fill="var(--surface)" />
    <circle cx="15" cy="12" r="1.9" fill="var(--surface)" />
    <circle cx="7" cy="17" r="1.9" fill="var(--surface)" />
  </svg>
);

export default function App({ repository }: { repository: StorageRepository }) {
  return (
    <AppProvider repository={repository}>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DayLogScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/foods" element={<FoodsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        <nav className="app-nav">
          <NavLink to="/" end>
            <LogIcon />
            <span>Log</span>
          </NavLink>
          <NavLink to="/search">
            <SearchIcon />
            <span>Search</span>
          </NavLink>
          <NavLink to="/foods">
            <FoodsIcon />
            <span>Foods</span>
          </NavLink>
          <NavLink to="/settings">
            <SettingsIcon />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </AppProvider>
  );
}
