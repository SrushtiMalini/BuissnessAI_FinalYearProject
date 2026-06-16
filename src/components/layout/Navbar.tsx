import { Link, useLocation } from 'react-router-dom';
import { BarChart2, Upload, UtensilsCrossed, TrendingUp, FileText, MessageSquare, Home, ChefHat } from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/upload', label: 'Upload Data', icon: Upload },
  { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp },
  { to: '/report', label: 'Reports', icon: FileText },
  { to: '/chat', label: 'AI Analyst', icon: MessageSquare },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0D1117] border-b border-[#30363D]">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-[#4ADE80] font-bold text-lg shrink-0">
          <ChefHat size={22} />
          <span>BusinessIQ</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                pathname.startsWith(to)
                  ? 'bg-[#4ADE80]/10 text-[#4ADE80]'
                  : 'text-gray-400 hover:text-white hover:bg-[#161B22]'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
