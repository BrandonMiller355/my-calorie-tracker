import { NavLink, Route, Routes } from 'react-router-dom';
import { DayLogScreen } from './screens/DayLogScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppProvider } from './state/AppState';
import type { StorageRepository } from './storage';

export default function App({ repository }: { repository: StorageRepository }) {
  return (
    <AppProvider repository={repository}>
      <div className="app">
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
