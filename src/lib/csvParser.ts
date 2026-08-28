import type { BillingEntry } from '../types';

export interface RowIssue {
  rowNumber: number;
  rawValues: string[];
  reason: string;
  type: 'error' | 'warning';
}

export interface ParseResult {
  entries: BillingEntry[];
  errors: string[];
  issues: RowIssue[];
  totalRows: number;
}

export interface ParseProgress {
  processed: number;
  total: number;
  pct: number;
}

const MEAL_PERIODS: Record<string, BillingEntry['mealPeriod']> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  brunch: 'breakfast',
  snack: 'other',
};

function inferMealPeriod(time?: string): BillingEntry['mealPeriod'] {
  if (!time) return 'other';
  const [h] = time.split(':').map(Number);
  if (h >= 6 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 23) return 'dinner';
  return 'other';
}

function detectDelimiter(sample: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of sample) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function normaliseDate(raw: string): { date: string; ambiguous: boolean } | null {
  if (!raw) return null;
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return { date: raw.slice(0, 10), ambiguous: false };
  // DD/MM/YYYY or DD-MM-YYYY (assumed)
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const year = y.length === 2 ? `20${y}` : y;
    return {
      date: `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      ambiguous: day <= 12 && month <= 12 && day !== month,
    };
  }
  return null;
}

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    date: ['date', 'order_date', 'sale_date', 'transaction_date', 'day'],
    time: ['time', 'order_time', 'sale_time', 'hour'],
    dishName: ['dish', 'dish_name', 'item', 'item_name', 'product', 'name', 'menu_item', 'description'],
    quantity: ['qty', 'quantity', 'count', 'units', 'sold', 'quantity_sold'],
    sellingPrice: ['price', 'selling_price', 'unit_price', 'rate', 'amount', 'revenue', 'total'],
    mealPeriod: ['meal', 'meal_period', 'period', 'shift', 'session'],
  };

  headers.forEach((h, i) => {
    const norm = h.toLowerCase().trim().replace(/\s+/g, '_');
    for (const [field, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(norm) && !(field in map)) {
        map[field] = i;
      }
    }
  });

  return map;
}

export function parseCSV(
  text: string,
  onProgress?: (p: ParseProgress) => void
): Promise<ParseResult> {
  return new Promise(resolve => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      resolve({ entries: [], errors: ['File appears empty or has only a header.'], issues: [], totalRows: 0 });
      return;
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
    const colMap = mapHeaders(headers);

    if (!('date' in colMap) || !('dishName' in colMap)) {
      resolve({
        entries: [],
        errors: [
          `Could not find required columns. Found: ${headers.join(', ')}. ` +
          'Need at least a date column and a dish/item name column.',
        ],
        issues: [],
        totalRows: 0,
      });
      return;
    }

    const entries: BillingEntry[] = [];
    const issues: RowIssue[] = [];
    const dataLines = lines.slice(1);
    const total = dataLines.length;
    const BATCH = 500;
    let i = 0;

    function processBatch() {
      const end = Math.min(i + BATCH, total);
      for (; i < end; i++) {
        const line = dataLines[i];
        if (!line.trim()) continue;

        // Handle quoted fields
        const cols = line.match(/(".*?"|[^",\t;|]+|(?<=,)(?=,)|(?<=^)(?=,))/g) ?? line.split(delimiter);
        const clean = cols.map(c => c.replace(/^["']|["']$/g, '').trim());

        const rowNumber = i + 2;
        const rawDate = clean[colMap.date];
        const normalised = normaliseDate(rawDate);
        if (!normalised) {
          issues.push({ rowNumber, rawValues: clean, reason: `invalid date format ("${rawDate}")`, type: 'error' });
          continue;
        }
        const date = normalised.date;
        if (normalised.ambiguous) {
          issues.push({ rowNumber, rawValues: clean, reason: `ambiguous date ("${rawDate}"), assumed DD/MM`, type: 'warning' });
        }

        const dishName = clean[colMap.dishName ?? -1]?.trim();
        if (!dishName) {
          issues.push({ rowNumber, rawValues: clean, reason: 'missing dish name', type: 'error' });
          continue;
        }

        const quantity = colMap.quantity !== undefined
          ? parseFloat(clean[colMap.quantity]) || 1
          : 1;

        let sellingPrice = 0;
        if (colMap.sellingPrice !== undefined) {
          const rawPrice = clean[colMap.sellingPrice];
          const parsedPrice = parseFloat(rawPrice?.replace(/[₹,\s]/g, ''));
          sellingPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
          if (rawPrice && !Number.isFinite(parsedPrice)) {
            issues.push({ rowNumber, rawValues: clean, reason: `non-numeric price ("${rawPrice}")`, type: 'warning' });
          }
        }

        const time = colMap.time !== undefined ? clean[colMap.time] : undefined;
        const mealPeriodRaw = colMap.mealPeriod !== undefined ? clean[colMap.mealPeriod]?.toLowerCase() : undefined;
        const mealPeriod = mealPeriodRaw
          ? MEAL_PERIODS[mealPeriodRaw] ?? inferMealPeriod(time)
          : inferMealPeriod(time);

        entries.push({
          id: `${date}-${dishName}-${i}`,
          date,
          time,
          dishName,
          quantity,
          sellingPrice,
          mealPeriod,
        });
      }

      onProgress?.({ processed: i, total, pct: Math.round((i / total) * 100) });

      if (i < total) {
        setTimeout(processBatch, 0);
      } else {
        resolve({ entries, errors: [], issues, totalRows: total });
      }
    }

    processBatch();
  });
}

export function generateSampleCSV(): string {
  const dishes = ['Dal Fry', 'Paneer Butter Masala', 'Veg Thali', 'Rajma Chawal', 'Egg Curry', 'Roti', 'Jeera Rice'];
  const prices: Record<string, number> = {
    'Dal Fry': 80, 'Paneer Butter Masala': 160, 'Veg Thali': 120,
    'Rajma Chawal': 90, 'Egg Curry': 100, 'Roti': 15, 'Jeera Rice': 60,
  };
  const rows = ['date,time,dish_name,quantity,selling_price,meal_period'];
  const today = new Date();
  for (let d = 29; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().slice(0, 10);
    const periods = [
      { time: '08:30', period: 'breakfast', count: 3 },
      { time: '13:00', period: 'lunch', count: 8 },
      { time: '19:30', period: 'dinner', count: 6 },
    ];
    for (const { time, period, count } of periods) {
      const shuffled = [...dishes].sort(() => Math.random() - 0.5).slice(0, count);
      for (const dish of shuffled) {
        const qty = Math.floor(Math.random() * 8) + 1;
        rows.push(`${dateStr},${time},${dish},${qty},${prices[dish]},${period}`);
      }
    }
  }
  return rows.join('\n');
}
