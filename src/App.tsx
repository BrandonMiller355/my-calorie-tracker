import { NavLink, Route, Routes } from 'react-router-dom';
import { DayLogScreen } from './screens/DayLogScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppProvider, useAppState } from './state/AppState';
import type { StorageRepository } from './storage';

function PersistenceBanner() {
  const { persistent } = useAppState();
  if (persistent) return null;
  return (
    <div className="persistence-banner" role="alert">
      Storage is unavailable in this browser — your data will not be saved after you close or
      reload the page.
    </div>
  );
}

export default function App({
  repository,
  persistent,
}: {
  repository: StorageRepository;
  persistent: boolean;
}) {
  return (
    <AppProvider repository={repository} persistent={persistent}>
      <div className="app">
        <PersistenceBanner />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DayLogScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
        <nav className="app-nav">
          <NavLink to="/" end>
            Log
          </NavLink>
          <NavLink to="/search">Search</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </div>
    </AppProvider>
  );
}
