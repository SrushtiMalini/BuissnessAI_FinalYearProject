import type { ReactNode, MouseEventHandler } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
  [key: string]: unknown;
}

export function Card({ children, className = '', title, action }: CardProps) {
  return (
    <div className={`bg-[#161B22] border border-[#30363D] rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-white font-semibold text-sm">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: string;
}

export function StatCard({ label, value, sub, trend, color = '#4ADE80' }: StatCardProps) {
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-2xl" style={{ color }}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last week
        </p>
      )}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  [key: string]: unknown;
}

const variantClasses: Record<string, string> = {
  green: 'bg-green-400/10 text-green-400 border-green-400/20',
  amber: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  red: 'bg-red-400/10 text-red-400 border-red-400/20',
  blue: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  gray: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({ children, variant = 'primary', size = 'md', loading, className = '', disabled, onClick, type = 'button', ...rest }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-[#4ADE80] text-[#0D1117] hover:bg-[#22c55e]',
    secondary: 'bg-[#161B22] text-white border border-[#30363D] hover:bg-[#21262d]',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || disabled}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-white font-bold text-2xl">{title}</h1>
      {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
