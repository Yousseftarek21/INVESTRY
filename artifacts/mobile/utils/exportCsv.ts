import { Share } from 'react-native';
import { Holding } from '@/types';
import { CashAccount } from '@/types';

function esc(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function row(...cells: unknown[]): string {
  return cells.map(esc).join(',');
}

function holdingToRows(h: Holding): string[] {
  if (h.type === 'gold') return [row('Gold', `${h.karat} ${h.form}`, h.grams, 'grams', h.purchasePricePerGram, h.purchaseDate, h.notes ?? '')];
  if (h.type === 'silver') return [row('Silver', h.form, h.grams, 'grams', h.purchasePricePerGram, h.purchaseDate, h.notes ?? '')];
  if (h.type === 'stock') return [row('Stock', h.symbol, h.shares, 'shares', h.purchasePricePerShare, h.purchaseDate, h.notes ?? '')];
  if (h.type === 'real_estate') return [row('Real Estate', h.propertyName, h.area, 'm²', h.purchasePrice, h.purchaseDate, h.notes ?? '')];
  if (h.type === 'personal_asset') return [row('Personal Asset', `${h.name} (${h.category})`, 1, h.currency, h.purchasePrice, h.purchaseDate, h.notes ?? '')];
  if (h.type === 'fixed_income') return [row('Fixed Income', `${h.subtype} - ${h.label}`, h.principal, 'EGP', h.annualRate + '%', h.purchaseDate, h.notes ?? '')];
  return [];
}

export async function exportPortfolioCSV(
  holdings: Holding[],
  cashAccounts: CashAccount[],
): Promise<void> {
  const holdingsHeader = row('Type', 'Name/Symbol', 'Quantity', 'Unit', 'Purchase Price', 'Purchase Date', 'Notes');
  const holdingRows = holdings.flatMap(holdingToRows);

  const cashHeader = row('Account Type', 'Account Name', 'Balance', 'Currency', 'Date Added', 'Notes');
  const cashRows = cashAccounts.map(a =>
    row(a.type, a.accountName, a.balance, a.currency, a.dateAdded ?? '', a.notes ?? '')
  );

  const sections = [
    '# INVESTRY Portfolio Export',
    `# Exported: ${new Date().toLocaleDateString('en-EG')}`,
    '',
    '## INVESTMENTS',
    holdingsHeader,
    ...holdingRows,
    '',
    '## CASH ACCOUNTS',
    cashHeader,
    ...cashRows,
  ];

  const csv = sections.join('\n');
  const date = new Date().toISOString().split('T')[0];

  await Share.share({
    title: `INVESTRY_portfolio_${date}.csv`,
    message: csv,
  });
}
