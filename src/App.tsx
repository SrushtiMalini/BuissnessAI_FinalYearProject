import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
import { storage, hydrate } from './lib/storage';
import { authClient } from './lib/authClient';

// Re-populates the in-memory billing/menu/reports/opportunities cache from the server
// on every app boot (page refresh, direct URL nav) — without this, a refresh would
// briefly (and then permanently, since nothing re-triggers it) show stale/empty data
// even though the server copy is intact.
function HydrateGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !authClient.isAuthenticated());

  useEffect(() => {
    if (!authClient.isAuthenticated()) return;
    let cancelled = false;
    hydrate().finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-[var(--color-unity)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  if (!authClient.isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: ReactNode }) {
  const restaurant = storage.getRestaurant();
  if (!restaurant) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// The inverse of RequireOnboarding: "/" is the onboarding wizard's own route, but
// nothing previously checked whether onboarding was already done before rendering
// it — so a new tab, a bookmark, or just typing the bare domain always showed the
// wizard from an empty first step, even for a fully onboarded account, looking
// exactly like "the app forgot my session" even though the data was intact.
function RedirectIfOnboarded({ children }: { children: ReactNode }) {
  const restaurant = storage.getRestaurant();
  if (restaurant) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Menu is a locked, explicit, owner-controlled entity (see MenuPage.tsx /
// menuEngine.ts) — it must exist before any billing data can be uploaded, so
// there's always a menu for upload-time dish matching to check against.
function RequireMenu({ children }: { children: ReactNode }) {
  const menu = storage.getMenu();
  if (!menu.length) return <Navigate to="/menu" replace />;
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
      <HydrateGate>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<RequireAuth><RedirectIfOnboarded><OnboardingPage /></RedirectIfOnboarded></RequireAuth>} />

        <Route path="/dashboard" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/upload" element={<AppLayout><RequireMenu><UploadPage /></RequireMenu></AppLayout>} />
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
      </HydrateGate>
    </BrowserRouter>
  );
}
