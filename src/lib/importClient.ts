import type { ParseResult, RowIssue } from './csvParser';

export interface ImportStatus {
  filename: string | null;
  timestamp: string | null;
  success: boolean;
  rowsImported: number;
  errorCount: number;
  message: string;
  entries?: ParseResult['entries'];
  issues?: RowIssue[];
}

export interface TriggerImportResponse {
  found: boolean;
  message?: string;
  status?: ImportStatus;
}

export const importClient = {
  async getStatus(): Promise<ImportStatus> {
    const res = await fetch('/api/import/status');
    return res.json();
  },
  async trigger(): Promise<TriggerImportResponse> {
    const res = await fetch('/api/import/trigger', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
};
