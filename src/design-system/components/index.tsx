import type { ReactNode, MouseEventHandler, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ─── Button ─────────────────────────────────────────────────────────────────

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children, variant = 'primary', size = 'md', loading,
  className = '', disabled, onClick, type = 'button',
}: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const variants = {
    primary: 'bg-[var(--color-unity)] text-[var(--color-text-inverse)] hover:opacity-90',
    secondary: 'border border-[var(--color-unity)] text-[var(--color-unity)] bg-transparent hover:bg-[var(--color-unity)]/8',
    ghost: 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-default)] border border-transparent',
    danger: 'bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:opacity-90',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-[var(--text-xs)]',
    md: 'px-4 py-2 text-[var(--text-sm)]',
    lg: 'px-6 py-3 text-[var(--text-base)]',
  };
  return (
    <button type={type} onClick={onClick} disabled={loading || disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  key?: string | number;
}

export function Card({ children, className = '', title, subtitle, action, padding = 'md' }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div className={`bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] ${paddings[padding]} ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h3 className="font-semibold text-[var(--color-text-primary)] text-[var(--text-lg)]">{title}</h3>}
            {subtitle && <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 ml-4">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  dot?: boolean;
  key?: string | number;
}

const badgeStyles = {
  success: 'bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success)]/20',
  warning: 'bg-[var(--color-warning-light)] text-amber-700 border-[var(--color-warning)]/30',
  danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger)] border-[var(--color-danger)]/20',
  neutral: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
  info: 'bg-[var(--color-info-light)] text-[var(--color-info)] border-[var(--color-info)]/20',
};

const dotStyles = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  neutral: 'bg-[var(--color-text-muted)]',
  info: 'bg-[var(--color-info)]',
};

export function Badge({ children, variant = 'neutral', dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[var(--text-xs)] font-medium border ${badgeStyles[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}

// ─── MetricTile ──────────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string;
  valueFont?: 'display' | 'mono' | 'body';
  change?: number;
  changeLabel?: string;
  subtext?: string;
  accent?: string;
  icon?: ReactNode;
  status?: 'good' | 'warning' | 'danger';
}

const STATUS_COLORS = {
  good: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

export function MetricTile({ label, value, valueFont = 'body', change, changeLabel, subtext, accent, icon, status }: MetricTileProps) {
  const fontClass = valueFont === 'display' ? 'font-["DM_Serif_Display"]' : valueFont === 'mono' ? 'font-["IBM_Plex_Mono"]' : 'font-bold';
  const isUp = change !== undefined && change >= 0;
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6"
      style={status ? { borderLeft: `3px solid ${STATUS_COLORS[status]}` } : undefined}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">{label}</p>
        <div className="flex items-center gap-2 shrink-0">
          {status && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} title={status} />}
          {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
        </div>
      </div>
      <p className={`text-[var(--text-4xl)] ${fontClass} text-[var(--color-text-primary)] leading-none mb-2`}
        style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {change !== undefined && (
        <p className={`text-[var(--text-xs)] font-medium ${isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
          {isUp ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%{changeLabel ? ` ${changeLabel}` : ''}
        </p>
      )}
      {subtext && <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-1">{subtext}</p>}
    </div>
  );
}

// ─── DataTable ───────────────────────────────────────────────────────────────

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  numeric?: boolean;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  emptyState?: ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, keyField, emptyState, loading, onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey as keyof T];
        const bv = b[sortKey as keyof T];
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  if (loading) return <TableSkeleton cols={columns.length} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[var(--text-sm)]">
        <thead>
          <tr className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-default)]">
            {columns.map(col => (
              <th key={String(col.key)}
                className={`px-4 py-3 text-[var(--text-xs)] uppercase tracking-wider text-[var(--color-text-muted)] font-medium border-b border-[var(--color-border-default)] ${col.numeric ? 'text-right font-["IBM_Plex_Mono"]' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:text-[var(--color-text-primary)] select-none' : ''}`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable && toggleSort(String(col.key))}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && (
                    sortKey === String(col.key)
                      ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      : <ChevronsUpDown size={12} className="opacity-40" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
              {emptyState ?? 'No data'}
            </td></tr>
          ) : sorted.map((row, i) => (
            <tr key={keyField ? String(row[keyField]) : i}
              className={`border-b border-[var(--color-border-default)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={String(col.key)}
                  className={`px-4 py-3 text-[var(--color-text-primary)] ${col.numeric ? 'text-right font-["IBM_Plex_Mono"] tabular-nums' : ''}`}>
                  {col.render ? col.render(row, i) : String(row[col.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b border-[var(--color-border-default)]">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-[var(--color-bg-secondary)] rounded animate-pulse" style={{ width: `${60 + (j * 20) % 40}%` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-[var(--color-text-muted)] mb-4">{icon}</div>}
      <h3 className="font-medium text-[var(--text-lg)] text-[var(--color-text-primary)] mb-2">{title}</h3>
      {description && <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── LoadingSkeleton ─────────────────────────────────────────────────────────

interface SkeletonProps { className?: string; }

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-[var(--color-bg-secondary)] rounded animate-pulse ${className}`} />;
}

export function MetricTileSkeleton() {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-lg)] p-6">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-10 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

interface AlertProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}

const alertStyles = {
  success: 'bg-[var(--color-success-light)] border-[var(--color-success)]/30 text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-light)] border-[var(--color-warning)]/30 text-amber-700',
  danger: 'bg-[var(--color-danger-light)] border-[var(--color-danger)]/30 text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-light)] border-[var(--color-info)]/30 text-[var(--color-info)]',
};

export function Alert({ variant = 'info', title, children, onClose }: AlertProps) {
  return (
    <div className={`border rounded-[var(--radius-md)] p-4 ${alertStyles[variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {title && <p className="font-medium text-[var(--text-sm)] mb-1">{title}</p>}
          <div className="text-[var(--text-sm)] opacity-90">{children}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="opacity-60 hover:opacity-100 text-inherit shrink-0">×</button>
        )}
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[var(--color-carbon)]/40 backdrop-blur-sm" />
      <div className={`relative bg-[var(--color-bg-card)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] w-full ${width} max-h-[90vh] overflow-auto`}
        onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-default)]">
            <h2 className="font-semibold text-[var(--text-xl)] text-[var(--color-text-primary)]">{title}</h2>
            <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-xl leading-none">×</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps { children: ReactNode; content: string; }

export function Tooltip({ children, content }: TooltipProps) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--color-carbon)] text-[var(--color-text-inverse)] text-[var(--text-xs)] rounded-[var(--radius-sm)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {content}
      </span>
    </span>
  );
}

// ─── PageHeader ──────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[var(--text-2xl)] font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {subtitle && <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Pill (toggle button, for single/multi-select option groups) ─────────────

interface PillProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  key?: string | number;
}

export function Pill({ selected, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium border transition-colors ${
        selected
          ? 'bg-[var(--color-unity)] border-[var(--color-unity)] text-[var(--color-text-inverse)]'
          : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      {children}
    </button>
  );
}

// ─── FormField (labeled wrapper for a single input) ──────────────────────────

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  key?: string | number;
}

export function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-[var(--color-text-secondary)] text-sm mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

export const formInputClass = 'w-full bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-[var(--radius-md)] px-3 py-2 text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-focus)]';

// ─── Stat (legacy compat) ────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: string;
}

/** @deprecated Use MetricTile instead */
export function StatCard({ label, value, sub, trend, color }: StatCardProps) {
  return (
    <MetricTile
      label={label}
      value={value}
      subtext={sub}
      change={trend}
      accent={color}
    />
  );
}
