import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { parseCSV, generateSampleCSV, type ParseProgress } from '../lib/csvParser';
import { storage } from '../lib/storage';
import { Button, Card, PageHeader } from '../components/ui';
import type { BillingEntry } from '../types';

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [result, setResult] = useState<{ entries: BillingEntry[]; errors: string[]; totalRows: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const processFile = useCallback(async (text: string) => {
    setError('');
    setResult(null);
    setSaved(false);
    setProgress({ processed: 0, total: 1, pct: 0 });

    const res = await parseCSV(text, p => setProgress(p));
    setProgress(null);
    setResult(res);

    if (res.errors.length && !res.entries.length) {
      setError(res.errors[0]);
    }
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

  function loadSample() {
    processFile(generateSampleCSV());
  }

  function saveAndContinue() {
    if (!result?.entries.length) return;
    const added = storage.appendBilling(result.entries);
    setSaved(true);
    setTimeout(() => navigate('/menu'), 800);
  }

  function downloadSample() {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_billing.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Upload Billing Data"
        subtitle="Upload your POS export or use sample data to get started"
      />

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
          <p className="text-white font-medium mb-1">Drop your CSV file here</p>
          <p className="text-gray-500 text-sm">Supports exports from Petpooja, Poster POS, or any CSV with date + dish columns</p>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="secondary" onClick={loadSample} className="flex-1 justify-center">
            Use Sample Data (30 days)
          </Button>
          <Button variant="secondary" onClick={downloadSample} className="flex-1 justify-center">
            <Download size={14} /> Download Sample CSV
          </Button>
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

      {result && result.entries.length > 0 && (
        <Card title="Preview" className="mb-4">
          <div className="flex gap-6 mb-4">
            <div><p className="text-[#4ADE80] font-bold text-xl">{result.entries.length.toLocaleString()}</p><p className="text-gray-400 text-xs">Rows imported</p></div>
            <div><p className="text-white font-bold text-xl">{[...new Set(result.entries.map(e => e.date))].length}</p><p className="text-gray-400 text-xs">Days of data</p></div>
            <div><p className="text-white font-bold text-xl">{[...new Set(result.entries.map(e => e.dishName))].length}</p><p className="text-gray-400 text-xs">Unique dishes</p></div>
            {result.errors.length > 0 && <div><p className="text-amber-400 font-bold text-xl">{result.errors.length}</p><p className="text-gray-400 text-xs">Skipped rows</p></div>}
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
                    <td className="py-2 pr-4 text-white">{e.dishName}</td>
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
                <CheckCircle size={16} /> <span className="text-sm">Saved! Redirecting...</span>
              </div>
            ) : (
              <Button onClick={saveAndContinue}>
                Save & Continue to Menu Setup →
              </Button>
            )}
          </div>
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
    </div>
  );
}
