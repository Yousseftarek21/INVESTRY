import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Holding, MarketPrices, CashAccount } from '@/types';
import { goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { getRECurrentValue } from '@/utils/rePrice';

// ─── Per-holding value/cost (EGP) ─────────────────────────────────────────────
// Mirrors the logic in app/(tabs)/index.tsx — kept as a local copy rather than
// a shared import since this repo already duplicates these helpers per-screen
// (index.tsx, analytics.tsx, HoldingCard.tsx all have their own copies).

function personalAssetValueEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  const v = h.currentValue ?? h.purchasePrice;
  if (h.currency === 'USD' && prices) return v * prices.usdToEgp;
  return v;
}

function personalAssetCostEGP(h: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  if (h.currency === 'USD' && prices) return h.purchasePrice * prices.usdToEgp;
  return h.purchasePrice;
}

function fixedIncomeAccruedValue(h: Extract<Holding, { type: 'fixed_income' }>, asOf: Date = new Date()): number {
  // Monthly/quarterly-payout certificates pay interest out to a linked
  // account each period rather than compounding it back into the
  // certificate — its own redemption value stays flat at principal until
  // maturity. Only at-maturity products actually accrue into their value.
  // (Matches components/HoldingCard.tsx, the canonical per-holding display.)
  if (h.paymentFrequency !== 'at_maturity') return h.principal;

  const purchase = new Date(h.purchaseDate);
  const maturity = new Date(h.maturityDate);
  const daysTotal = Math.max(1, (maturity.getTime() - purchase.getTime()) / 86400000);
  const daysElapsed = Math.max(0, Math.min(daysTotal, (asOf.getTime() - purchase.getTime()) / 86400000));
  return h.principal * (1 + (h.annualRate / 100) * (daysElapsed / 365));
}

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'fixed_income') return fixedIncomeAccruedValue(h);
  if (h.type === 'real_estate') return getRECurrentValue(h);
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * (prices.egxPrices?.[h.symbol] ?? h.purchasePricePerShare);
  if (h.type === 'personal_asset') return personalAssetValueEGP(h, prices);
  return 0;
}

function computeCost(h: Holding, prices?: MarketPrices): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  if (h.type === 'personal_asset') return personalAssetCostEGP(h, prices);
  if (h.type === 'fixed_income') return h.principal;
  return 0;
}

function typeLabel(h: Holding): string {
  switch (h.type) {
    case 'gold': return 'Gold';
    case 'silver': return 'Silver';
    case 'stock': return 'Stock';
    case 'real_estate': return 'Real Estate';
    case 'personal_asset': return 'Personal Asset';
    case 'fixed_income': return 'Fixed Income';
  }
}

function nameOf(h: Holding): string {
  switch (h.type) {
    case 'gold': return `Gold (${h.karat})`;
    case 'silver': return 'Silver';
    case 'stock': return `${h.companyName} (${h.symbol})`;
    case 'real_estate': return h.propertyName;
    case 'personal_asset': return h.name;
    case 'fixed_income': return h.label;
  }
}

function quantityOf(h: Holding): string {
  switch (h.type) {
    case 'gold':
    case 'silver': return `${h.grams} g`;
    case 'stock': return `${h.shares} shares`;
    case 'real_estate': return `${h.area} m²`;
    case 'personal_asset': return '1';
    case 'fixed_income': return `${h.principal.toLocaleString('en-EG')} principal`;
  }
}

interface ExportRow {
  type: string;
  name: string;
  quantity: string;
  purchaseDate: string;
  cost: number;
  value: number;
  gain: number;
  gainPct: number;
}

function buildRows(holdings: Holding[], prices?: MarketPrices): ExportRow[] {
  return holdings.map(h => {
    const cost = computeCost(h, prices);
    const value = computeValue(h, prices);
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return {
      type: typeLabel(h),
      name: nameOf(h),
      quantity: quantityOf(h),
      purchaseDate: h.purchaseDate,
      cost, value, gain, gainPct,
    };
  });
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function n2(n: number): string {
  return n.toFixed(2);
}

// ─── CSV ───────────────────────────────────────────────────────────────────────

export function buildPortfolioCsv(holdings: Holding[], cashAccounts: CashAccount[], prices?: MarketPrices): string {
  const rows = buildRows(holdings, prices);
  const header = ['Type', 'Name', 'Quantity', 'Purchase Date', 'Cost (EGP)', 'Current Value (EGP)', 'Gain/Loss (EGP)', 'Gain/Loss (%)'];
  const lines = [header.join(',')];

  for (const r of rows) {
    lines.push([
      csvEscape(r.type), csvEscape(r.name), csvEscape(r.quantity), csvEscape(r.purchaseDate),
      n2(r.cost), n2(r.value), n2(r.gain), n2(r.gainPct),
    ].join(','));
  }

  if (cashAccounts.length > 0) {
    lines.push('');
    lines.push(['Cash Account', 'Type', 'Balance', 'Currency'].join(','));
    for (const a of cashAccounts) {
      lines.push([csvEscape(a.accountName), csvEscape(a.type), n2(a.balance), csvEscape(a.currency)].join(','));
    }
  }

  return lines.join('\n');
}

// ─── PDF (via HTML → expo-print) ──────────────────────────────────────────────

export function buildPortfolioHtml(
  holdings: Holding[],
  cashAccounts: CashAccount[],
  prices: MarketPrices | undefined,
  opts: { userName?: string; generatedAt?: Date } = {},
): string {
  const rows = buildRows(holdings, prices);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const cashTotal = cashAccounts.reduce((s, a) => s + (a.currency === 'EGP' ? a.balance : a.balance * (prices?.usdToEgp ?? 1)), 0);
  const generatedAt = (opts.generatedAt ?? new Date()).toLocaleString('en-EG');
  const gainColor = totalGain >= 0 ? '#00976E' : '#E03030';

  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.type}</td>
      <td>${r.name}</td>
      <td>${r.quantity}</td>
      <td>${r.purchaseDate}</td>
      <td class="num">${r.cost.toLocaleString('en-EG', { maximumFractionDigits: 0 })}</td>
      <td class="num">${r.value.toLocaleString('en-EG', { maximumFractionDigits: 0 })}</td>
      <td class="num" style="color:${r.gain >= 0 ? '#00976E' : '#E03030'}">
        ${r.gain >= 0 ? '+' : ''}${r.gain.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
      </td>
    </tr>
  `).join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #121212; padding: 24px; }
        h1 { font-size: 20px; margin-bottom: 2px; }
        .sub { color: #78808F; font-size: 12px; margin-bottom: 20px; }
        .cards { display: flex; gap: 12px; margin-bottom: 24px; }
        .card { flex: 1; border: 1px solid #E8E0D0; border-radius: 10px; padding: 12px 14px; }
        .card .label { font-size: 11px; color: #78808F; margin-bottom: 4px; }
        .card .value { font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { text-align: left; background: #F5F1E8; padding: 8px 10px; font-size: 10px; text-transform: uppercase; color: #78808F; }
        td { padding: 7px 10px; border-bottom: 1px solid #F0EBE0; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }
        .footer { margin-top: 20px; font-size: 10px; color: #78808F; }
      </style>
    </head>
    <body>
      <h1>INVESTRY — Portfolio Report</h1>
      <div class="sub">${opts.userName ? opts.userName + ' · ' : ''}Generated ${generatedAt}</div>

      <div class="cards">
        <div class="card">
          <div class="label">TOTAL PORTFOLIO VALUE</div>
          <div class="value">${totalValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP</div>
        </div>
        <div class="card">
          <div class="label">TOTAL GAIN/LOSS</div>
          <div class="value" style="color:${gainColor}">
            ${totalGain >= 0 ? '+' : ''}${totalGain.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP (${totalGainPct.toFixed(1)}%)
          </div>
        </div>
        <div class="card">
          <div class="label">CASH</div>
          <div class="value">${cashTotal.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Type</th><th>Name</th><th>Quantity</th><th>Purchase Date</th>
            <th class="num">Cost</th><th class="num">Value</th><th class="num">Gain/Loss</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div class="footer">This report reflects market data at the time of export and is for personal record-keeping only.</div>
    </body>
  </html>
  `;
}

// ─── Share actions ─────────────────────────────────────────────────────────────

async function shareFile(uri: string, mimeType: string) {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined });
}

export async function exportPortfolioAsCsv(holdings: Holding[], cashAccounts: CashAccount[], prices?: MarketPrices): Promise<void> {
  const csv = buildPortfolioCsv(holdings, cashAccounts, prices);
  const uri = `${FileSystem.cacheDirectory}investry-portfolio-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' });
  await shareFile(uri, 'text/csv');
}

export async function exportPortfolioAsPdf(
  holdings: Holding[],
  cashAccounts: CashAccount[],
  prices: MarketPrices | undefined,
  opts: { userName?: string } = {},
): Promise<void> {
  const html = buildPortfolioHtml(holdings, cashAccounts, prices, opts);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await shareFile(uri, 'application/pdf');
}
