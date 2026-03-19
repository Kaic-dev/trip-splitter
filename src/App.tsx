import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import MainTripPage from './pages/MainTripPage';
import TripHistoryDashboard from './pages/TripHistoryDashboard';
import TripDetailPage from './pages/TripDetailPage';
import './App.css';

import { AppVersionLabel } from './components/common/AppVersionLabel';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    console.log("📍 App Route Changed:", location.pathname);
  }, [location]);

  return (
    <>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<MainTripPage />} />
          <Route path="/historico" element={<TripHistoryDashboard />} />
          <Route path="/historico/:id" element={<TripDetailPage />} />
          {/* Fallback to main screen */}
          <Route path="*" element={<MainTripPage />} />
        </Routes>
      </div>
      <AppVersionLabel />
    </>
  );
}
