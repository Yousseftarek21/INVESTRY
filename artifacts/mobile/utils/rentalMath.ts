import type { MarketPrices, RentalBooking, RentalExpense, RentalLease, RentalUnit } from '@/types';

// All rental dates are calendar days (YYYY-MM-DD). They're handled as whole
// UTC day numbers so no device timezone can shift a night across a boundary.
const DAY_MS = 86_400_000;
export const dayNum = (iso: string): number => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
export const dayIso = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
export const monthOf = (iso: string): string => iso.slice(0, 7);

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

/** [start, end) in day numbers. */
export interface Period { start: number; end: number }

export function monthPeriod(ym: string): Period {
  const [y, m] = ym.split('-').map(Number);
  return {
    start: Math.round(Date.UTC(y, m - 1, 1) / DAY_MS),
    end: Math.round(Date.UTC(y, m, 1) / DAY_MS),
  };
}

export function yearPeriod(year: number): Period {
  return { start: Math.round(Date.UTC(year, 0, 1) / DAY_MS), end: Math.round(Date.UTC(year + 1, 0, 1) / DAY_MS) };
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthsBetween(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

// ── Currency ──────────────────────────────────────────────────────────────────
function egpPer(currency: string, prices: MarketPrices | undefined): number | null {
  if (currency === 'EGP') return 1;
  if (!prices) return null;
  if (currency === 'USD') return prices.usdToEgp || null;
  const rate = prices.fxRates?.[currency as keyof NonNullable<MarketPrices['fxRates']>];
  return typeof rate === 'number' && rate > 0 ? rate : null;
}

/** Converts between currencies through EGP. Same currency never needs a rate. */
export function convert(amount: number, from: string, to: string, prices: MarketPrices | undefined): number {
  if (from === to || !amount) return amount;
  const a = egpPer(from, prices);
  const b = egpPer(to, prices);
  if (a == null || b == null) return amount;
  return (amount * a) / b;
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingNights = (b: Pick<RentalBooking, 'checkIn' | 'checkOut'>): number =>
  Math.max(0, dayNum(b.checkOut) - dayNum(b.checkIn));

/** What the owner actually gets: guest total minus the platform's cut. */
export const bookingPayout = (b: Pick<RentalBooking, 'totalAmount' | 'platformFee'>): number =>
  Math.max(0, (b.totalAmount || 0) - (b.platformFee || 0));

const isActive = (b: RentalBooking) => b.status !== 'cancelled';

/** Bookings on the same unit whose nights overlap the candidate's. */
export function overlappingBookings(
  candidate: Pick<RentalBooking, 'id' | 'unitId' | 'checkIn' | 'checkOut'>,
  bookings: RentalBooking[],
): RentalBooking[] {
  const s = dayNum(candidate.checkIn);
  const e = dayNum(candidate.checkOut);
  if (e <= s) return [];
  return bookings.filter(b =>
    b.id !== candidate.id && b.unitId === candidate.unitId && isActive(b) &&
    overlap(s, e, dayNum(b.checkIn), dayNum(b.checkOut)) > 0);
}

// ── Leases ────────────────────────────────────────────────────────────────────
const leaseEndExclusive = (l: RentalLease): number =>
  l.endDate ? dayNum(l.endDate) + 1 : Number.POSITIVE_INFINITY;

/** Rent for a given month, after yearly increases on each anniversary. */
export function leaseRentFor(l: RentalLease, ym: string): number {
  const years = Math.max(0, Math.floor(monthsBetween(monthOf(l.startDate), ym) / 12));
  const pct = l.annualIncreasePct || 0;
  return Math.round(l.monthlyRent * Math.pow(1 + pct / 100, years) * 100) / 100;
}

export type RentStatus = 'paid' | 'partial' | 'waived' | 'overdue' | 'due';

export interface RentMonth {
  month: string;
  dueDate: string;
  due: number;
  paid: number;
  status: RentStatus;
}

/** Due date for a lease month: the due day, but never before the lease starts. */
function dueDateFor(l: RentalLease, ym: string): string {
  const due = `${ym}-${String(Math.min(Math.max(l.dueDay || 1, 1), 28)).padStart(2, '0')}`;
  return ym === monthOf(l.startDate) && due < l.startDate ? l.startDate : due;
}

/** Every rent month from the lease start through `untilYm`, within the lease. */
export function rentSchedule(l: RentalLease, untilYm: string, today: string): RentMonth[] {
  const out: RentMonth[] = [];
  const first = monthOf(l.startDate);
  const last = l.endDate && monthOf(l.endDate) < untilYm ? monthOf(l.endDate) : untilYm;
  for (let ym = first; ym <= last; ym = addMonths(ym, 1)) {
    const due = leaseRentFor(l, ym);
    const payments = l.payments.filter(p => p.month === ym);
    const waived = payments.some(p => p.waived);
    const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const dueDate = dueDateFor(l, ym);
    const status: RentStatus = waived ? 'waived'
      : paid >= due - 0.005 ? 'paid'
      : paid > 0 ? 'partial'
      : dueDate < today ? 'overdue'
      : 'due';
    out.push({ month: ym, dueDate, due, paid, status });
    if (out.length > 600) break;
  }
  return out;
}

export const isLeaseActive = (l: RentalLease, today: string): boolean =>
  l.startDate <= today && (!l.endDate || l.endDate >= today);

// ── Expenses ──────────────────────────────────────────────────────────────────
/** Every date an expense applies on, within [period). */
export function expenseOccurrences(e: RentalExpense, p: Period): string[] {
  if (!e.monthly) {
    const d = dayNum(e.date);
    return d >= p.start && d < p.end ? [e.date] : [];
  }
  const out: string[] = [];
  const day = Number(e.date.slice(8, 10));
  const untilDay = e.monthlyUntil ? dayNum(e.monthlyUntil) : Number.POSITIVE_INFINITY;
  for (let ym = monthOf(e.date); ; ym = addMonths(ym, 1)) {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const iso = `${ym}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
    const n = dayNum(iso);
    if (n >= p.end || n > untilDay) break;
    if (n >= p.start) out.push(iso);
    if (out.length > 600) break;
  }
  return out;
}

// ── Per-unit stats ────────────────────────────────────────────────────────────
export interface UnitData {
  unit: RentalUnit;
  bookings: RentalBooking[];
  leases: RentalLease[];
  expenses: RentalExpense[];
}

export interface UnitStats {
  income: number;
  bookingIncome: number;
  rentIncome: number;
  expenses: number;
  net: number;
  nights: number;
  occupiedNights: number;
  bookedNights: number;
  occupancy: number | null;
  /** Average payout per booked night (short stays only). */
  avgNightly: number | null;
  bookingCount: number;
}

/** Income, costs and occupancy for one unit over a period, in the unit's currency. */
export function unitStats(d: UnitData, p: Period, prices: MarketPrices | undefined, today: string): UnitStats {
  const cur = d.unit.currency;
  let bookingIncome = 0;
  let bookedNights = 0;
  let bookingCount = 0;
  const occupied = new Set<number>();

  for (const b of d.bookings) {
    if (!isActive(b)) continue;
    const s = dayNum(b.checkIn);
    const nights = bookingNights(b);
    const payout = convert(bookingPayout(b), b.currency, cur, prices);
    if (nights === 0) {
      if (s >= p.start && s < p.end) { bookingIncome += payout; bookingCount++; }
      continue;
    }
    const inside = overlap(s, s + nights, p.start, p.end);
    if (inside === 0) continue;
    bookingIncome += payout * (inside / nights);
    bookedNights += inside;
    bookingCount++;
    for (let n = Math.max(s, p.start); n < Math.min(s + nights, p.end); n++) occupied.add(n);
  }

  let rentIncome = 0;
  const lastYm = monthOf(dayIso(p.end - 1));
  for (const l of d.leases) {
    for (const r of rentSchedule(l, lastYm, today)) {
      const mp = monthPeriod(r.month);
      if (mp.start >= p.end || mp.end <= p.start) continue;
      if (r.status !== 'waived') rentIncome += convert(r.due, l.currency, cur, prices);
    }
    const ls = dayNum(l.startDate);
    const le = leaseEndExclusive(l);
    for (let n = Math.max(ls, p.start); n < Math.min(le, p.end); n++) occupied.add(n);
  }

  let expenses = 0;
  for (const e of d.expenses) {
    const count = expenseOccurrences(e, p).length;
    if (count) expenses += convert(e.amount, e.currency, cur, prices) * count;
  }

  const nights = p.end - p.start;
  const income = bookingIncome + rentIncome;
  return {
    income,
    bookingIncome,
    rentIncome,
    expenses,
    net: income - expenses,
    nights,
    occupiedNights: occupied.size,
    bookedNights,
    occupancy: nights > 0 ? occupied.size / nights : null,
    avgNightly: bookedNights > 0 ? bookingIncome / bookedNights : null,
    bookingCount,
  };
}

/** Earliest date anything was recorded on the unit (for "all time"). */
export function unitStart(d: UnitData): string {
  const dates = [
    d.unit.createdAt.slice(0, 10),
    ...d.bookings.map(b => b.checkIn),
    ...d.leases.map(l => l.startDate),
    ...d.expenses.map(e => e.date),
  ];
  return dates.reduce((a, b) => (b < a ? b : a));
}

export interface MonthPoint { month: string; income: number; expenses: number; net: number }

/** The last `count` months ending with `endYm`, oldest first. */
export function monthlySeries(d: UnitData, endYm: string, count: number, prices: MarketPrices | undefined, today: string): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const ym = addMonths(endYm, -i);
    const s = unitStats(d, monthPeriod(ym), prices, today);
    out.push({ month: ym, income: s.income, expenses: s.expenses, net: s.net });
  }
  return out;
}

// ── Money owed and what's next ────────────────────────────────────────────────
export interface Outstanding {
  /** Stays that have started but whose payout isn't marked received. */
  unpaidBookings: RentalBooking[];
  overdueRent: Array<{ lease: RentalLease; month: RentMonth }>;
  total: number;
}

export function outstanding(d: UnitData, prices: MarketPrices | undefined, today: string): Outstanding {
  const cur = d.unit.currency;
  const unpaidBookings = d.bookings.filter(b => isActive(b) && !b.received && b.checkIn <= today);
  const overdueRent: Outstanding['overdueRent'] = [];
  for (const l of d.leases) {
    for (const m of rentSchedule(l, monthOf(today), today)) {
      if ((m.status === 'overdue' || m.status === 'partial') && m.dueDate < today) overdueRent.push({ lease: l, month: m });
    }
  }
  const total =
    unpaidBookings.reduce((s, b) => s + convert(bookingPayout(b), b.currency, cur, prices), 0) +
    overdueRent.reduce((s, r) => s + convert(r.month.due - r.month.paid, r.lease.currency, cur, prices), 0);
  return { unpaidBookings, overdueRent, total };
}

export type NextEvent =
  | { kind: 'checkin'; date: string; booking: RentalBooking }
  | { kind: 'checkout'; date: string; booking: RentalBooking }
  | { kind: 'rent'; date: string; lease: RentalLease; month: RentMonth }
  | { kind: 'lease_end'; date: string; lease: RentalLease };

/** Upcoming check-ins/outs, rent due dates and lease ends, soonest first. */
export function upcomingEvents(d: UnitData, today: string, horizonDays = 60): NextEvent[] {
  const limit = dayIso(dayNum(today) + horizonDays);
  const out: NextEvent[] = [];
  for (const b of d.bookings) {
    if (!isActive(b)) continue;
    if (b.checkIn >= today && b.checkIn <= limit) out.push({ kind: 'checkin', date: b.checkIn, booking: b });
    else if (b.checkIn < today && b.checkOut >= today && b.checkOut <= limit) out.push({ kind: 'checkout', date: b.checkOut, booking: b });
  }
  for (const l of d.leases) {
    const next = rentSchedule(l, monthOf(limit), today).find(m => m.dueDate >= today && m.status === 'due');
    if (next && next.dueDate <= limit) out.push({ kind: 'rent', date: next.dueDate, lease: l, month: next });
    if (l.endDate && l.endDate >= today && l.endDate <= limit) out.push({ kind: 'lease_end', date: l.endDate, lease: l });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** What occupies each night of a month: a booking id, 'lease', or nothing. */
export function monthOccupancy(d: UnitData, ym: string): Map<number, { bookingId?: string; lease?: boolean }> {
  const p = monthPeriod(ym);
  const map = new Map<number, { bookingId?: string; lease?: boolean }>();
  for (const l of d.leases) {
    for (let n = Math.max(dayNum(l.startDate), p.start); n < Math.min(leaseEndExclusive(l), p.end); n++) map.set(n, { lease: true });
  }
  for (const b of d.bookings) {
    if (!isActive(b)) continue;
    const s = dayNum(b.checkIn);
    for (let n = Math.max(s, p.start); n < Math.min(s + bookingNights(b), p.end); n++) map.set(n, { bookingId: b.id });
  }
  return map;
}
