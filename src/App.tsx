import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import OnboardingPage from './pages/OnboardingPage';
import UploadPage from './pages/UploadPage';
import MenuPage from './pages/MenuPage';
import DashboardPage from './pages/DashboardPage';
import ForecastPage from './pages/ForecastPage';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';
import { storage } from './lib/storage';

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D1117]">
      <Navbar />
      <main className="pt-14 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const restaurant = storage.getRestaurant();
  if (!restaurant) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OnboardingPage />} />
        <Route path="/upload" element={<RequireOnboarding><Layout><UploadPage /></Layout></RequireOnboarding>} />
        <Route path="/menu" element={<RequireOnboarding><Layout><MenuPage /></Layout></RequireOnboarding>} />
        <Route path="/dashboard" element={<RequireOnboarding><Layout><DashboardPage /></Layout></RequireOnboarding>} />
        <Route path="/forecast" element={<RequireOnboarding><Layout><ForecastPage /></Layout></RequireOnboarding>} />
        <Route path="/report" element={<RequireOnboarding><Layout><ReportPage /></Layout></RequireOnboarding>} />
        <Route path="/chat" element={<RequireOnboarding><Layout><ChatPage /></Layout></RequireOnboarding>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
