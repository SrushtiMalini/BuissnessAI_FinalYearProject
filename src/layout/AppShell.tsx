import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, UtensilsCrossed, TrendingUp, FileText, MessageSquare,
  ChefHat, Package, Trash2, DollarSign, Users, BarChart2, Settings, Menu, X,
  Bell, Megaphone, LogOut,
} from 'lucide-react';
import { storage } from '../lib/storage';
import { authClient } from '../lib/authClient';

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/report', label: 'Reports', icon: FileText },
      { to: '/chat', label: 'AI Analyst', icon: MessageSquare },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { to: '/ml/ingredients', label: 'Ingredient Forecast', icon: Package },
      { to: '/ml/wastage', label: 'Wastage Management', icon: Trash2 },
      { to: '/ml/pricing', label: 'Dynamic Pricing', icon: DollarSign },
      { to: '/ml/promotions', label: 'Promotion Analysis', icon: Megaphone },
      { to: '/ml/workforce', label: 'Workforce Planning', icon: Users },
    ],
  },
  {
    section: 'Settings',
    items: [
      { to: '/menu', label: 'Menu Setup', icon: UtensilsCrossed },
      { to: '/forecast', label: 'Forecasting', icon: TrendingUp },
      { to: '/upload', label: 'Upload Data', icon: Upload },
    ],
  },
];

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    authClient.logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      {/* Overlay for mobile */}
      {!collapsed && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onToggle} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-200
          ${collapsed ? '-translate-x-full md:translate-x-0 md:w-14' : 'w-60 translate-x-0'}`}
        style={{ backgroundColor: 'var(--color-bg-sidebar)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 h-14 px-4 border-b border-white/10 shrink-0">
          <ChefHat size={22} style={{ color: 'var(--color-sunburst)' }} />
          {!collapsed && (
            <span className="font-semibold text-[var(--color-text-inverse)] text-[var(--text-base)] tracking-tight">
              BusinessIQ
            </span>
          )}
          <button onClick={onToggle} className="ml-auto text-white/40 hover:text-white/80 hidden md:flex">
            <Menu size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV.map(group => (
            <div key={group.section} className="mb-5">
              {!collapsed && (
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-medium px-2 mb-1.5">
                  {group.section}
                </p>
              )}
              {group.items.map(({ to, label, icon: Icon }) => {
                const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));
                return (
                  <Link key={to} to={to}
                    title={collapsed ? label : undefined}
                    className={`flex items-center gap-3 px-2 py-2 rounded-[var(--radius-md)] mb-0.5 transition-colors group
                      ${active
                        ? 'bg-[var(--color-unity)]/30 text-[var(--color-text-inverse)] border-l-[3px] border-[var(--color-sunburst)]'
                        : 'text-white/50 hover:text-white/90 hover:bg-white/8'
                      }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && (
                      <span className="text-[var(--text-sm)] font-medium">{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-[var(--radius-md)] text-white/50 hover:text-white/90 hover:bg-white/8 transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span className="text-[var(--text-sm)] font-medium">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const restaurant = storage.getRestaurant();
  return (
    <header className="fixed top-0 right-0 z-20 h-14 flex items-center gap-4 px-4 md:px-6"
      style={{
        left: 'var(--sidebar-width, 240px)',
        backgroundColor: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border-default)',
      }}>
      <button onClick={onMenuClick} className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
        <Menu size={20} />
      </button>
      <span className="font-[var(--font-display)] text-[var(--text-lg)] text-[var(--color-text-primary)] truncate">
        {restaurant?.name ?? 'BusinessIQ'}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button className="relative p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors rounded-[var(--radius-md)] hover:bg-[var(--color-bg-secondary)]">
          <Bell size={18} />
        </button>
        <Link to="/upload"
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-unity)', color: 'var(--color-text-inverse)' }}>
          <Upload size={14} /> Upload
        </Link>
      </div>
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main className="p-4 md:p-6 animate-fade-in">
      {children}
    </main>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarW = collapsed ? 56 : 240;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)', fontFamily: 'var(--font-body)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div style={{ marginLeft: sidebarW, transition: 'margin-left 0.2s' }}>
        <Topbar onMenuClick={() => setCollapsed(false)} />
        <div className="pt-14">
          <PageContainer>{children}</PageContainer>
        </div>
      </div>
    </div>
  );
}
