import { useState, useRef, useCallback, useEffect } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Info, ChevronDown, ChevronRight, FolderSync, PlusCircle, Ban, FlaskConical } from 'lucide-react';
import { parseCSV, type ParseProgress, type ParseResult } from '../lib/csvParser';
import { storage } from '../lib/storage';
import {
  matchAgainstLockedMenu, applyDishResolutions,
  type MenuMatchResult, type UnmatchedDishResolution, type ResolvedImport,
} from '../lib/menuEngine';
import { generateOpportunities } from '../lib/opportunityEngine';
import { trackForecastAccuracy } from '../lib/forecastAccuracyEngine';
import { importClient, type ImportStatus } from '../lib/importClient';
import { Button, Card, PageHeader, Modal } from '../components/ui';

const ISSUES_DISPLAY_CAP = 200;
const AUTO_IMPORT_APPLIED_KEY_BASE = 'biq_auto_import_applied_at';
const AUTO_IMPORT_POLL_MS = 5000;

function autoImportAppliedKey(): string {
  const restaurantId = localStorage.getItem('biq_restaurant_id') ?? 'anon';
  return `${AUTO_IMPORT_APPLIED_KEY_BASE}_${restaurantId}`;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [autoImportLoading, setAutoImportLoading] = useState(false);
  const [autoImportMessage, setAutoImportMessage] = useState('');
  const [saveSummary, setSaveSummary] = useState<{ added: number; total: number; excluded: { name: string; rowCount: number }[] } | null>(null);

  // Dish matching (locked menu — uploads never add/remove/modify menu_items
  // automatically; every unmatched dish name needs an explicit owner decision
  // before any of its rows are saved). `match` is recomputed against the
  // current menu whenever a new file/trigger produces `result`.
  const [match, setMatch] = useState<MenuMatchResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, UnmatchedDishResolution>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [draftPrice, setDraftPrice] = useState<Record<string, { price: string; cost: string }>>({});

  // A batch detected by the background poll (not the manual upload/trigger UI)
  // that has unmatched dishes waits here for the owner to resolve instead of
  // being silently auto-saved — same rule as every other upload path.
  const [pendingAutoImportTimestamp, setPendingAutoImportTimestamp] = useState<string | null>(null);
  const seenAutoImportTimestamps = useRef<Set<string>>(new Set());

  // Testing Tools — "Generate Next Day" (see below). Never touches billing until
  // the owner explicitly confirms the preview; entirely separate from the
  // real-upload state above.
  const [testGenLoading, setTestGenLoading] = useState(false);
  const [testGenPreview, setTestGenPreview] = useState<
    { requestId: string; date: string; totalOrders: number; totalRevenue: number; rowCount: number } | null
  >(null);
  const [testGenResolving, setTestGenResolving] = useState(false);
  const [testGenError, setTestGenError] = useState('');
  const [testGenSuccess, setTestGenSuccess] = useState<{ added: number; total: number } | null>(null);

  const allResolved = match ? match.unmatchedDishNames.every(name => name in resolutions) : true;

  function beginReview(entries: ParseResult['entries']) {
    const m = matchAgainstLockedMenu(entries, storage.getMenu());
    setMatch(m);
    setResolutions({});
    setDraftPrice({});
    if (m.unmatchedDishNames.length > 0) setReviewOpen(true);
  }

  async function finalizeSave(matchResult: MenuMatchResult, entries: ParseResult['entries'], autoImportTimestamp: string | null) {
    const resolved: ResolvedImport = matchResult.unmatchedDishNames.length
      ? applyDishResolutions(matchResult, storage.getMenu(), resolutions)
      : { entriesToSave: matchResult.matched, newMenuItems: [], excluded: [] };

    if (resolved.newMenuItems.length) {
      const ok = await storage.setMenu([...storage.getMenu(), ...resolved.newMenuItems]);
      if (!ok) {
        setError('Could not save the new menu items. Please try again.');
        return false;
      }
    }

    const { added, total, ok } = await storage.appendBilling(resolved.entriesToSave);
    if (!ok) {
      setError('Could not reach the server to save your data. Please try again.');
      return false;
    }

    const fullBilling = storage.getBilling();
    const menu = storage.getMenu();
    await generateOpportunities(fullBilling, menu);
    await trackForecastAccuracy(fullBilling);

    setSaveSummary({ added, total, excluded: resolved.excluded });
    setSaved(true);
    if (autoImportTimestamp) localStorage.setItem(autoImportAppliedKey(), autoImportTimestamp);
    return true;
  }

  // Poll the auto-import status. A detected batch is only ever silently
  // auto-saved when every dish in it already matches the menu; otherwise it's
  // held for the same explicit review as a manual upload — the menu is never
  // touched without the owner's say-so, regardless of which path data came in.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const status = await importClient.getStatus();
        if (cancelled) return;
        setImportStatus(status);

        if (!status.success || !status.timestamp || !status.entries?.length) return;
        if (localStorage.getItem(autoImportAppliedKey()) === status.timestamp) return;
        if (seenAutoImportTimestamps.current.has(status.timestamp)) return;
        seenAutoImportTimestamps.current.add(status.timestamp);

        const m = matchAgainstLockedMenu(status.entries, storage.getMenu());
        if (m.unmatchedDishNames.length === 0) {
          await storage.appendBilling(status.entries);
          const fullBilling = storage.getBilling();
          await generateOpportunities(fullBilling, storage.getMenu());
          await trackForecastAccuracy(fullBilling);
          localStorage.setItem(autoImportAppliedKey(), status.timestamp);
        } else {
          setResult({ entries: status.entries, issues: status.issues ?? [], errors: [], totalRows: status.entries.length });
          setSaved(false);
          setSaveSummary(null);
          setError('');
          setMatch(m);
          setResolutions({});
          setDraftPrice({});
          setPendingAutoImportTimestamp(status.timestamp);
          setReviewOpen(true);
        }
      } catch {
        // status polling is best-effort; ignore transient failures
      }
    }

    poll();
    const interval = setInterval(poll, AUTO_IMPORT_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function handleAutoImportTrigger() {
    setAutoImportMessage('');
    setAutoImportLoading(true);
    try {
      const res = await importClient.trigger();
      if (!res.found) {
        setAutoImportMessage(res.message ?? 'No new export found in the watched folder.');
      } else if (res.status?.success && res.status.entries) {
        setResult({
          entries: res.status.entries,
          issues: res.status.issues ?? [],
          errors: [],
          totalRows: res.status.entries.length,
        });
        setSaved(false);
        setSaveSummary(null);
        setError('');
        setPendingAutoImportTimestamp(null); // manual trigger — always saved right away like a manual upload
        beginReview(res.status.entries);
        setImportStatus(res.status);
      } else {
        setAutoImportMessage(res.status?.message ?? 'Import failed — see data/incoming/failed for details.');
        setImportStatus(res.status ?? null);
      }
    } catch (err: any) {
      setAutoImportMessage(err.message ?? 'Import failed');
    } finally {
      setAutoImportLoading(false);
    }
  }

  const processFile = useCallback(async (text: string) => {
    setError('');
    setResult(null);
    setSaved(false);
    setSaveSummary(null);
    setIssuesOpen(false);
    setMatch(null);
    setPendingAutoImportTimestamp(null);
    setProgress({ processed: 0, total: 1, pct: 0 });

    const res = await parseCSV(text, p => setProgress(p));
    setProgress(null);
    setResult(res);

    if (!res.entries.length) {
      setError(res.errors[0] ?? 'No valid rows found — see Import Issues below.');
      return;
    }
    beginReview(res.entries);
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => processFile(e.target?.result as string);
    reader.readAsText(file);
  }, [processFile]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function saveAndContinue() {
    if (!result?.entries.length || !match) return;
    if (!allResolved) { setReviewOpen(true); return; }
    setError('');
    const ok = await finalizeSave(match, result.entries, pendingAutoImportTimestamp);
    if (ok) setTimeout(() => navigate('/menu'), 800);
  }

  function cancelReview() {
    // Cancelling never applies a default — nothing is saved, nothing is added
    // to the menu. The auto-import timestamp is deliberately NOT marked
    // applied, so the same batch will be offered for review again on the next
    // poll instead of silently disappearing.
    setReviewOpen(false);
    setResult(null);
    setMatch(null);
    setResolutions({});
    setPendingAutoImportTimestamp(null);
  }

  function resolveExclude(name: string) {
    setResolutions(prev => ({ ...prev, [name]: { action: 'exclude' } }));
  }

  function startAdd(name: string) {
    setDraftPrice(prev => ({ ...prev, [name]: prev[name] ?? { price: '', cost: '' } }));
  }

  function confirmAdd(name: string) {
    const draft = draftPrice[name];
    const sellingPrice = parseFloat(draft?.price ?? '');
    const rawMaterialCost = parseFloat(draft?.cost ?? '');
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return;
    setResolutions(prev => ({
      ...prev,
      [name]: { action: 'add', sellingPrice, rawMaterialCost: Number.isFinite(rawMaterialCost) ? rawMaterialCost : 0 },
    }));
  }

  function undoResolution(name: string) {
    setResolutions(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  // ─── Testing Tools: "Generate Next Day" ──────────────────────────────────────
  // Generates one synthetic day of sales from this restaurant's real, locked
  // menu on the server, previews it, and — on confirmation — runs it through
  // the same insertBillingEntries path a real upload uses, then the same
  // client-side post-save steps (dish matching for consistency, Opportunity
  // Engine, forecast-accuracy tracking) as finalizeSave above.

  async function handleGenerateNextDay() {
    setTestGenError('');
    setTestGenLoading(true);
    try {
      const preview = await storage.generateNextDayTestData();
      setTestGenPreview(preview);
    } catch (err: any) {
      setTestGenError(err.message ?? 'Failed to generate test data');
    } finally {
      setTestGenLoading(false);
    }
  }

  async function handleConfirmNextDay() {
    if (!testGenPreview) return;
    setTestGenResolving(true);
    setTestGenError('');
    try {
      const { entries, added, total } = await storage.confirmNextDayTestData(testGenPreview.requestId);

      // Generated rows are always drawn from the current menu, so this should always
      // come back fully matched — run it anyway for consistency with the real-upload
      // path, and to stay correct if the menu changes between generate and confirm.
      const menu = storage.getMenu();
      const generatedMatch = matchAgainstLockedMenu(entries, menu);
      if (generatedMatch.unmatchedDishNames.length) {
        const autoResolutions: Record<string, UnmatchedDishResolution> = {};
        for (const name of generatedMatch.unmatchedDishNames) {
          const sample = generatedMatch.unmatched.find(e => e.dishName.trim().toLowerCase() === name.trim().toLowerCase());
          autoResolutions[name] = { action: 'add', sellingPrice: sample?.sellingPrice ?? 0, rawMaterialCost: 0 };
        }
        const resolved = applyDishResolutions(generatedMatch, menu, autoResolutions);
        if (resolved.newMenuItems.length) await storage.setMenu([...menu, ...resolved.newMenuItems]);
      }

      const fullBilling = storage.getBilling();
      await generateOpportunities(fullBilling, storage.getMenu());
      await trackForecastAccuracy(fullBilling);

      setTestGenSuccess({ added, total });
      setTestGenPreview(null);
    } catch (err: any) {
      setTestGenError(err.message ?? 'Failed to import generated test data');
    } finally {
      setTestGenResolving(false);
    }
  }

  async function handleDiscardNextDay() {
    if (!testGenPreview) return;
    setTestGenResolving(true);
    try {
      await storage.discardNextDayTestData(testGenPreview.requestId);
    } catch (err: any) {
      setTestGenError(err.message ?? 'Failed to discard generated test data');
    } finally {
      setTestGenPreview(null);
      setTestGenResolving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Upload Billing Data"
        subtitle="Upload your POS export to get started"
      />

      {importStatus?.timestamp && (
        <p className="text-gray-500 text-xs mb-3 flex items-center gap-1.5">
          <FolderSync size={12} />
          Last auto-import: {new Date(importStatus.timestamp).toLocaleString()} ·{' '}
          {importStatus.success ? `${importStatus.rowsImported} rows` : 'failed'} ({importStatus.filename})
        </p>
      )}

      <Card className="mb-4">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            dragging ? 'border-[#4ADE80] bg-[#4ADE80]/5' : 'border-[#30363D] hover:border-[#4ADE80]/50'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={36} className="text-gray-500 mx-auto mb-3" />
          <p className="text-[var(--color-text-primary)] font-medium mb-1">Drop your CSV file here</p>
          <p className="text-gray-500 text-sm">Supports exports from Petpooja, Poster POS, or any CSV with date + dish columns</p>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="border-t border-[#30363D] mt-4 pt-4">
          <Button onClick={handleAutoImportTrigger} loading={autoImportLoading} className="w-full justify-center">
            <FolderSync size={14} /> Import Today's Sales
          </Button>
          <p className="text-gray-500 text-xs mt-2 text-center">
            Checks data/incoming/ for a POS export that hasn't been imported yet
          </p>
          {autoImportMessage && (
            <div className="flex items-center gap-2 text-gray-400 text-sm mt-2 justify-center">
              <Info size={14} className="shrink-0" />
              <span>{autoImportMessage}</span>
            </div>
          )}
        </div>
      </Card>

      {progress && (
        <Card className="mb-4">
          <p className="text-gray-400 text-sm mb-2">Parsing {progress.total.toLocaleString()} rows...</p>
          <div className="w-full bg-[#0D1117] rounded-full h-2">
            <div className="bg-[#4ADE80] h-2 rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="text-gray-500 text-xs mt-1">{progress.pct}% complete</p>
        </Card>
      )}

      {error && (
        <Card className="mb-4 border-red-500/30">
          <div className="flex gap-2 text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {match && match.unmatchedDishNames.length > 0 && !saved && (
        <Card className="mb-4 border-amber-500/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 text-amber-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-sm">
                {match.unmatchedDishNames.length} dish{match.unmatchedDishNames.length === 1 ? '' : 'es'} in this file
                {' '}{match.unmatchedDishNames.length === 1 ? "isn't" : "aren't"} on your menu yet
                {allResolved ? ' — all resolved.' : ' — resolve before saving.'}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>
              {allResolved ? 'Review decisions' : 'Resolve now'}
            </Button>
          </div>
        </Card>
      )}

      {result && result.entries.length > 0 && (
        <Card title="Preview" className="mb-4">
          <div className="flex gap-6 mb-4">
            <div><p className="text-[#4ADE80] font-bold text-xl">{result.entries.length.toLocaleString()}</p><p className="text-gray-400 text-xs">Rows imported</p></div>
            <div><p className="text-[var(--color-text-primary)] font-bold text-xl">{[...new Set(result.entries.map(e => e.date))].length}</p><p className="text-gray-400 text-xs">Days of data</p></div>
            <div><p className="text-[var(--color-text-primary)] font-bold text-xl">{[...new Set(result.entries.map(e => e.dishName))].length}</p><p className="text-gray-400 text-xs">Unique dishes</p></div>
            {result.issues.length > 0 && <div><p className="text-amber-400 font-bold text-xl">{result.issues.length}</p><p className="text-gray-400 text-xs">Flagged rows</p></div>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363D]">
                  {['Date', 'Dish', 'Qty', 'Price', 'Meal'].map(h => (
                    <th key={h} className="text-left text-gray-400 font-medium pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.entries.slice(0, 8).map((e, i) => (
                  <tr key={i} className="border-b border-[#30363D]/50">
                    <td className="py-2 pr-4 text-gray-300">{e.date}</td>
                    <td className="py-2 pr-4 text-[var(--color-text-primary)]">{e.dishName}</td>
                    <td className="py-2 pr-4 text-gray-300">{e.quantity}</td>
                    <td className="py-2 pr-4 text-gray-300">₹{e.sellingPrice}</td>
                    <td className="py-2 text-gray-400 capitalize">{e.mealPeriod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.entries.length > 8 && <p className="text-gray-500 text-xs mt-2">+{result.entries.length - 8} more rows</p>}
          </div>

          <div className="mt-4">
            {saved ? (
              <div className="flex items-center gap-2 text-[#4ADE80]">
                <CheckCircle size={16} />
                <span className="text-sm">
                  {saveSummary
                    ? `Added ${saveSummary.added.toLocaleString('en-IN')} new row${saveSummary.added === 1 ? '' : 's'} — ${saveSummary.total.toLocaleString('en-IN')} total rows now in history.`
                    : 'Saved!'}
                  {' '}Redirecting...
                </span>
              </div>
            ) : (
              <Button onClick={saveAndContinue} disabled={!allResolved}>
                {allResolved ? 'Save & Continue' : `Resolve ${match?.unmatchedDishNames.length ?? 0} unmatched dish${(match?.unmatchedDishNames.length ?? 0) === 1 ? '' : 'es'} first`}
              </Button>
            )}
            {saved && saveSummary && saveSummary.excluded.length > 0 && (
              <div className="mt-3 text-xs text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Excluded from this import (marked "not from this restaurant"):</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {saveSummary.excluded.map(x => (
                    <li key={x.name}>{x.name} — {x.rowCount} row{x.rowCount === 1 ? '' : 's'} not saved</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {result && result.issues.length > 0 && (
        <Card className="mb-4">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setIssuesOpen(o => !o)}
          >
            <span className="flex items-center gap-2 text-amber-400 font-medium text-sm">
              <AlertCircle size={16} />
              Import Issues ({result.issues.length})
            </span>
            {issuesOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </button>

          {issuesOpen && (
            <div className="mt-4 overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#30363D]">
                    {['Row', 'Type', 'Raw Values', 'Reason'].map(h => (
                      <th key={h} className="text-left text-gray-400 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.issues.slice(0, ISSUES_DISPLAY_CAP).map((issue, i) => (
                    <tr key={i} className="border-b border-[#30363D]/40">
                      <td className="py-1.5 pr-4 text-gray-300">{issue.rowNumber}</td>
                      <td className={`py-1.5 pr-4 capitalize ${issue.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{issue.type}</td>
                      <td className="py-1.5 pr-4 text-gray-400 font-mono">{issue.rawValues.join(', ')}</td>
                      <td className="py-1.5 text-gray-300">{issue.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.issues.length > ISSUES_DISPLAY_CAP && (
                <p className="text-gray-500 text-xs mt-2">+{result.issues.length - ISSUES_DISPLAY_CAP} more issues not shown</p>
              )}
            </div>
          )}
        </Card>
      )}

      <Card title="Expected CSV Format" className="text-sm">
        <p className="text-gray-400 mb-3">Your CSV should have these columns (column names are flexible):</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#30363D]">
                {['Column', 'Required', 'Example', 'Aliases accepted'].map(h => (
                  <th key={h} className="text-left text-gray-400 pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                ['date', '✓', '2024-01-15', 'order_date, sale_date, day'],
                ['dish_name', '✓', 'Dal Fry', 'item, product, description'],
                ['quantity', '', '3', 'qty, count, units, sold'],
                ['selling_price', '', '80', 'price, unit_price, amount'],
                ['time', '', '13:30', 'order_time, hour'],
                ['meal_period', '', 'lunch', 'meal, shift, session'],
              ].map(([col, req, ex, aliases]) => (
                <tr key={col} className="border-b border-[#30363D]/40">
                  <td className="py-1.5 pr-4 font-mono text-[#4ADE80]">{col}</td>
                  <td className="py-1.5 pr-4">{req}</td>
                  <td className="py-1.5 pr-4">{ex}</td>
                  <td className="py-1.5 text-gray-500">{aliases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 border-2 border-dashed border-amber-500/40 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={16} className="text-amber-400" />
          <h3 className="text-amber-400 font-semibold text-sm">Testing Tools</h3>
        </div>
        <p className="text-gray-500 text-xs mb-4">
          For testing only — not part of real data ingestion, and not something a real restaurant owner uses in
          production. Generates one realistic day of sales for this restaurant's actual menu, so the team can watch
          ML forecasts and Opportunity Engine recommendations evolve day by day, without waiting for real time to
          pass or hand-building test CSV files.
        </p>

        {testGenError && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-3">
            <AlertCircle size={14} className="shrink-0" />
            <span>{testGenError}</span>
          </div>
        )}

        {testGenSuccess ? (
          <div>
            <div className="flex items-center gap-2 text-[#4ADE80] text-sm mb-3">
              <CheckCircle size={16} />
              <span>
                Imported {testGenSuccess.added.toLocaleString('en-IN')} row{testGenSuccess.added === 1 ? '' : 's'} —{' '}
                {testGenSuccess.total.toLocaleString('en-IN')} total rows now in history.
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTestGenSuccess(null)}>Generate Another</Button>
          </div>
        ) : testGenPreview ? (
          <div>
            <p className="text-[var(--color-text-primary)] text-sm mb-3">
              Generated sales for <span className="font-mono">{testGenPreview.date}</span> —{' '}
              {testGenPreview.totalOrders.toLocaleString('en-IN')} orders, ₹{testGenPreview.totalRevenue.toLocaleString('en-IN')} revenue
              ({testGenPreview.rowCount} rows). Import this now?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleConfirmNextDay} loading={testGenResolving}>Yes, Import</Button>
              <Button size="sm" variant="ghost" onClick={handleDiscardNextDay} disabled={testGenResolving}>Discard</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={handleGenerateNextDay} loading={testGenLoading}>
            <FlaskConical size={14} /> Generate Next Day
          </Button>
        )}
      </div>

      <Modal open={reviewOpen} onClose={cancelReview} title="Unrecognized dishes found" width="max-w-2xl">
        {match && (
          <>
            <p className="text-[var(--color-text-secondary)] text-sm mb-4">
              We found {match.unmatchedDishNames.length} dish{match.unmatchedDishNames.length === 1 ? '' : 'es'} in this file that
              {match.unmatchedDishNames.length === 1 ? " isn't" : " aren't"} in your menu: for each, is this a new dish to add to your
              menu, or does this data not belong to this restaurant?
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {match.unmatchedDishNames.map(name => {
                const rowCount = match.unmatched.filter(e => e.dishName.trim().toLowerCase() === name.trim().toLowerCase()).length;
                const resolution = resolutions[name];
                const editing = name in draftPrice && !resolution;
                return (
                  <div key={name} className="border border-[var(--color-border-default)] rounded-[var(--radius-md)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[var(--color-text-primary)] font-medium text-sm">{name}</p>
                        <p className="text-[var(--color-text-muted)] text-xs">{rowCount} row{rowCount === 1 ? '' : 's'} in this file</p>
                      </div>
                      {resolution ? (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${resolution.action === 'add' ? 'text-[#4ADE80]' : 'text-amber-400'}`}>
                            {resolution.action === 'add'
                              ? `Adding at ₹${resolution.sellingPrice} / ₹${resolution.rawMaterialCost} cost`
                              : 'Not from this restaurant'}
                          </span>
                          <button onClick={() => undoResolution(name)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline">
                            Undo
                          </button>
                        </div>
                      ) : !editing ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="secondary" onClick={() => startAdd(name)}>
                            <PlusCircle size={14} /> Add to my menu
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => resolveExclude(name)}>
                            <Ban size={14} /> Not from this restaurant
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {editing && (
                      <div className="flex items-end gap-2 mt-3 pt-3 border-t border-[var(--color-border-default)]">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Selling price (₹)</label>
                          <input
                            type="number"
                            value={draftPrice[name]?.price ?? ''}
                            onChange={e => setDraftPrice(prev => ({ ...prev, [name]: { price: e.target.value, cost: prev[name]?.cost ?? '' } }))}
                            className="w-full mt-1 bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--color-border-focus)]"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Raw material cost (₹)</label>
                          <input
                            type="number"
                            value={draftPrice[name]?.cost ?? ''}
                            onChange={e => setDraftPrice(prev => ({ ...prev, [name]: { price: prev[name]?.price ?? '', cost: e.target.value } }))}
                            className="w-full mt-1 bg-transparent border border-[var(--color-border-default)] rounded-[var(--radius-sm)] px-2 py-1 text-[var(--color-text-primary)] text-sm font-mono focus:outline-none focus:border-[var(--color-border-focus)]"
                          />
                        </div>
                        <Button size="sm" onClick={() => confirmAdd(name)} disabled={!parseFloat(draftPrice[name]?.price || '0')}>
                          Confirm
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--color-border-default)]">
              <Button variant="ghost" onClick={cancelReview}>Cancel this import</Button>
              <Button onClick={() => setReviewOpen(false)} disabled={!allResolved}>
                {allResolved ? 'Done — back to preview' : `${match.unmatchedDishNames.length - Object.keys(resolutions).length} left to resolve`}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
