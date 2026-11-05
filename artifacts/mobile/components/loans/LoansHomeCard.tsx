import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLoans } from '@/context/LoansContext';
import { useDateFormat } from '@/components/rental/RentalUI';
import { fmtCompact } from '@/utils/formatNumber';
import { forwardChevron } from '@/utils/rtl';
import { convert, todayIso } from '@/utils/rentalMath';
import { isLoanPaidOff, loanStatus, totalLoansEGP } from '@/utils/loanMath';
import type { MarketPrices } from '@/types';

/**
 * What's left to pay on loans and installments, on Home. Shown only once a
 * loan exists. Kept on its own: it is never subtracted from the portfolio or
 * net worth figures, so investments and debts each read separately.
 */
export function LoansHomeCard({ prices, toDisp, displayCurrency, hideValues }: {
  prices: MarketPrices | undefined;
  toDisp: (egp: number) => number;
  displayCurrency: string;
  hideValues: boolean;
}) {
  const colors = useColors();
  const t = useT();
  const fmt = useDateFormat();
  const { impact } = useHaptic();
  const { loans } = useLoans();

  const summary = useMemo(() => {
    const open = loans.filter(l => !isLoanPaidOff(l));
    if (loans.length === 0) return null;
    const today = todayIso();
    // The soonest payment across all loans; an overdue one wins.
    let next: { date: string; overdue: boolean; amountEgp?: number } | null = null;
    for (const l of open) {
      const { status, nextDue } = loanStatus(l, today);
      if (!nextDue) continue;
      const overdue = status === 'overdue';
      if (!next || (overdue && !next.overdue) || (overdue === next.overdue && nextDue < next.date)) {
        next = { date: nextDue, overdue, amountEgp: l.monthlyPayment ? convert(l.monthlyPayment, l.currency, 'EGP', prices) : undefined };
      }
    }
    return { owedEgp: totalLoansEGP(loans, prices), count: open.length, next };
  }, [loans, prices]);

  if (!summary) return null;
  const money = (egp: number) => (hideValues ? '••••' : `${fmtCompact(toDisp(egp))} ${displayCurrency}`);
  const { next } = summary;
  const sub = next
    ? (next.overdue ? t.loanOverdue(fmt.day(next.date)) : t.loanNextDue(fmt.day(next.date)))
      + (next.amountEgp ? ` · ${money(next.amountEgp)}` : '')
    : summary.count > 0 ? t.loansHomeCount(summary.count) : t.loanPaidOff;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => { impact(); router.push('/loans' as any); }}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View style={[s.icon, { backgroundColor: colors.red + '1A' }]}>
        <Feather name="file-minus" size={18} color={colors.red} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.title, { color: colors.mutedForeground }]} numberOfLines={1}>{t.loansHomeCardTitle}</Text>
        <Text style={[s.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {hideValues ? '••••••' : (
            <>
              {fmtCompact(toDisp(summary.owedEgp))}{' '}
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{displayCurrency}</Text>
            </>
          )}
        </Text>
        <Text style={[s.sub, { color: next?.overdue ? colors.red : colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>
      </View>
      <Feather name={forwardChevron()} size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  value: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
