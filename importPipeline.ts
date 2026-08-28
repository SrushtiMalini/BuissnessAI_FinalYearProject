import fs from 'fs';
import path from 'path';
import { parseCSV } from './src/lib/csvParser.ts';
import type { ParseResult, RowIssue } from './src/lib/csvParser.ts';

const INCOMING_DIR = path.join(process.cwd(), 'data', 'incoming');
const PROCESSED_DIR = path.join(INCOMING_DIR, 'processed');
const FAILED_DIR = path.join(INCOMING_DIR, 'failed');
const STATUS_FILE = path.join(INCOMING_DIR, 'status.json');

for (const dir of [INCOMING_DIR, PROCESSED_DIR, FAILED_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

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

const EMPTY_STATUS: ImportStatus = {
  filename: null,
  timestamp: null,
  success: false,
  rowsImported: 0,
  errorCount: 0,
  message: 'No auto-import has run yet.',
};

function readStatus(): ImportStatus {
  try {
    if (!fs.existsSync(STATUS_FILE)) return EMPTY_STATUS;
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')) as ImportStatus;
  } catch {
    return EMPTY_STATUS;
  }
}

function writeStatus(status: ImportStatus): void {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function findIncomingCsv(): string | null {
  const files = fs.readdirSync(INCOMING_DIR, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.toLowerCase().endsWith('.csv'))
    .map(d => d.name)
    .sort();
  return files[0] ?? null;
}

function timestampPrefix(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

let importInProgress = false;

/**
 * Reads one unprocessed CSV from data/incoming/, runs it through the real parseCSV
 * pipeline, and files it under processed/ (success) or failed/ (with a .log.json)
 * depending on the outcome. Shared by both the fs.watch listener and the manual
 * trigger endpoint so there is exactly one place this logic lives.
 */
export async function runImport(filenameOverride?: string): Promise<ImportStatus | null> {
  if (importInProgress) return null;
  importInProgress = true;
  try {
    const filename = filenameOverride ?? findIncomingCsv();
    if (!filename) return null;

    const filePath = path.join(INCOMING_DIR, filename);
    if (!fs.existsSync(filePath)) return null;

    const text = fs.readFileSync(filePath, 'utf-8');
    const result: ParseResult = await parseCSV(text);
    const now = new Date();
    const prefix = timestampPrefix(now);
    const success = result.entries.length > 0;

    let status: ImportStatus;
    if (success) {
      fs.renameSync(filePath, path.join(PROCESSED_DIR, `${prefix}_${filename}`));
      status = {
        filename,
        timestamp: now.toISOString(),
        success: true,
        rowsImported: result.entries.length,
        errorCount: result.issues.filter(i => i.type === 'error').length,
        message: `Imported ${result.entries.length} row${result.entries.length === 1 ? '' : 's'} from ${filename}`,
        entries: result.entries,
        issues: result.issues,
      };
    } else {
      const destPath = path.join(FAILED_DIR, `${prefix}_${filename}`);
      fs.renameSync(filePath, destPath);
      fs.writeFileSync(
        `${destPath}.log.json`,
        JSON.stringify({ filename, errors: result.errors, issues: result.issues }, null, 2)
      );
      status = {
        filename,
        timestamp: now.toISOString(),
        success: false,
        rowsImported: 0,
        errorCount: result.issues.filter(i => i.type === 'error').length || result.errors.length,
        message: result.errors[0] ?? 'No valid rows found in file — see failed/ log for details.',
      };
    }

    writeStatus(status);
    return status;
  } finally {
    importInProgress = false;
  }
}

export function getLastStatus(): ImportStatus {
  return readStatus();
}

/** Watches data/incoming/ (non-recursive) for new .csv files and auto-imports them. */
export function watchIncoming(onImport?: (status: ImportStatus) => void): void {
  fs.watch(INCOMING_DIR, (_eventType, filename) => {
    if (!filename || !filename.toLowerCase().endsWith('.csv')) return;
    const filePath = path.join(INCOMING_DIR, filename);
    setTimeout(async () => {
      if (!fs.existsSync(filePath)) return; // already moved/handled, or was a rename-away event
      try {
        const status = await runImport(filename);
        if (status) onImport?.(status);
      } catch (err) {
        console.error('Auto-import failed:', err);
      }
    }, 300);
  });
}
