import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import OnboardingPage from './pages/OnboardingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UploadPage from './pages/UploadPage';
import SettingsPage from './pages/SettingsPage';
import OpportunityHistoryPage from './pages/OpportunityHistoryPage';
import MenuPage from './pages/MenuPage';
import DashboardPage from './pages/DashboardPage';
import ForecastPage from './pages/ForecastPage';
import ReportPage from './pages/ReportPage';
import ChatPage from './pages/ChatPage';
import WastageManagementPage from './pages/ml/WastageManagementPage';
import IngredientForecastPage from './pages/ml/IngredientForecastPage';
import WorkforcePlanningPage from './pages/ml/WorkforcePlanningPage';
import DynamicPricingPage from './pages/ml/DynamicPricingPage';
import PromotionAnalysisPage from './pages/ml/PromotionAnalysisPage';
import { storage } from './lib/storage';
import { authClient } from './lib/authClient';

function RequireAuth({ children }: { children: ReactNode }) {
  if (!authClient.isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const restaurant = storage.getRestaurant();
  if (!restaurant) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireOnboarding>
        <AppShell>{children}</AppShell>
      </RequireOnboarding>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/upload" element={<AppLayout><UploadPage /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
        <Route path="/menu" element={<AppLayout><MenuPage /></AppLayout>} />
        <Route path="/forecast" element={<AppLayout><ForecastPage /></AppLayout>} />
        <Route path="/report" element={<AppLayout><ReportPage /></AppLayout>} />
        <Route path="/chat" element={<AppLayout><ChatPage /></AppLayout>} />

        {/* ML pages */}
        <Route path="/ml/wastage" element={<AppLayout><WastageManagementPage /></AppLayout>} />
        <Route path="/opportunities" element={<AppLayout><OpportunityHistoryPage /></AppLayout>} />
        <Route path="/ml/ingredients" element={<AppLayout><IngredientForecastPage /></AppLayout>} />
        <Route path="/ml/workforce" element={<AppLayout><WorkforcePlanningPage /></AppLayout>} />
        <Route path="/ml/pricing" element={<AppLayout><DynamicPricingPage /></AppLayout>} />
        <Route path="/ml/promotions" element={<AppLayout><PromotionAnalysisPage /></AppLayout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
