import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { forwardChevron, backChevron } from '@/utils/rtl';
import { dayNum, monthOccupancy, monthPeriod, todayIso, type MonthPoint, type UnitData } from '@/utils/rentalMath';
import { fmtMoney, useDateFormat } from './RentalUI';

/** Month grid of which nights are booked (short stay) or leased. Week starts Saturday. */
export function RentalCalendar({ data, ym, onPrev, onNext, onBookingPress }: {
  data: UnitData;
  ym: string;
  onPrev: () => void;
  onNext: () => void;
  onBookingPress?: (bookingId: string) => void;
}) {
  const colors = useColors();
  const t = useT();
  const fmt = useDateFormat();
  const occ = useMemo(() => monthOccupancy(data, ym), [data, ym]);
  const p = monthPeriod(ym);
  const today = dayNum(todayIso());
  // JS getUTCDay: 0=Sun … 6=Sat; shift so Saturday is the first column.
  const firstCol = (new Date(p.start * 86_400_000).getUTCDay() + 1) % 7;
  const cells: Array<number | null> = [...Array(firstCol).fill(null)];
  for (let n = p.start; n < p.end; n++) cells.push(n);
  while (cells.length % 7) cells.push(null);
  const weekdays = fmt.weekdayInitials();

  return (
    <View style={{ gap: 10 }}>
      <View style={s.navRow}>
        <TouchableOpacity onPress={onPrev} hitSlop={10} accessibilityLabel={t.rpPrevMonth}><Feather name={backChevron()} size={18} color={colors.text} /></TouchableOpacity>
        <Text style={[s.month, { color: colors.text }]}>{fmt.month(ym)}</Text>
        <TouchableOpacity onPress={onNext} hitSlop={10} accessibilityLabel={t.rpNextMonth}><Feather name={forwardChevron()} size={18} color={colors.text} /></TouchableOpacity>
      </View>
      <View style={s.row}>
        {weekdays.map((w, i) => (
          <Text key={i} style={[s.weekday, { color: colors.mutedForeground }]}>{w}</Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={s.row}>
          {cells.slice(r * 7, r * 7 + 7).map((n, i) => {
            if (n == null) return <View key={i} style={s.cell} />;
            const o = occ.get(n);
            const bg = o?.bookingId ? colors.primary : o?.lease ? colors.green : 'transparent';
            const fg = o ? '#fff' : colors.text;
            const day = new Date(n * 86_400_000).getUTCDate();
            return (
              <TouchableOpacity
                key={i}
                style={s.cell}
                disabled={!o?.bookingId}
                onPress={() => o?.bookingId && onBookingPress?.(o.bookingId)}
                accessibilityLabel={`${day}${o?.bookingId ? `, ${t.rpLegendBooked}` : o?.lease ? `, ${t.rpLegendLeased}` : ''}`}
              >
                <View style={[s.dayDot, { backgroundColor: bg, borderColor: n === today ? colors.primary : 'transparent' }]}>
                  <Text style={[s.dayText, { color: fg }]}>{day}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={s.legend}>
        <View style={[s.legendSwatch, { backgroundColor: colors.primary }]} />
        <Text style={[s.legendText, { color: colors.mutedForeground }]}>{t.rpLegendBooked}</Text>
        <View style={[s.legendSwatch, { backgroundColor: colors.green, marginStart: 12 }]} />
        <Text style={[s.legendText, { color: colors.mutedForeground }]}>{t.rpLegendLeased}</Text>
      </View>
    </View>
  );
}

/** Net profit per month as bars around a zero line. */
export function MonthlyProfitBars({ points, currency }: { points: MonthPoint[]; currency: string }) {
  const colors = useColors();
  const fmt = useDateFormat();
  const maxAbs = Math.max(1, ...points.map(p => Math.abs(p.net)));
  const hasNegative = points.some(p => p.net < 0);
  const H = 96;
  const zeroY = hasNegative ? H / 2 : H;
  const scale = (hasNegative ? H / 2 : H) / maxAbs;
  const last = points[points.length - 1];

  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.legendText, { color: colors.mutedForeground }]}>
        {last ? `${fmt.monthShort(last.month)}: ${fmtMoney(last.net, currency)}` : ''}
      </Text>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'stretch', gap: 4 }}>
        {points.map(p => {
          const h = Math.max(p.net === 0 ? 0 : 2, Math.abs(p.net) * scale);
          return (
            <View key={p.month} style={{ flex: 1 }} accessibilityLabel={`${fmt.monthShort(p.month)} ${fmtMoney(p.net, currency)}`}>
              <View style={{
                position: 'absolute', left: 0, right: 0,
                top: p.net >= 0 ? zeroY - h : zeroY,
                height: h,
                borderRadius: 3,
                backgroundColor: p.net >= 0 ? colors.green : colors.red,
              }} />
            </View>
          );
        })}
        <View style={{ position: 'absolute', left: 0, right: 0, top: zeroY, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {points.map((p, i) => (
          <Text key={p.month} style={[s.barLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {i % 2 === points.length % 2 ? fmt.monthShort(p.month) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  barLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Inter_400Regular' },
});
