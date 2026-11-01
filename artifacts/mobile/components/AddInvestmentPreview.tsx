import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

export interface PreviewRow {
  label: string;
  value: number;
  /** Colors the value green/red by sign and prefixes "+". */
  signed?: boolean;
}

/**
 * Live "what you're adding" card on the Add investment form: what was paid,
 * what it's worth today, and the gain — recalculated as the user types, so a
 * typo (an extra zero, a per-gram price typed as a total) is visible before
 * saving. Renders nothing until every number it needs is valid.
 */
export function AddInvestmentPreview({ rows, currency, note }: {
  rows: PreviewRow[];
  currency: string;
  /** Small line under the numbers, e.g. which live price was used. */
  note?: string;
}) {
  const colors = useColors();
  const t = useT();
  const valid = rows.filter(r => Number.isFinite(r.value));
  if (valid.length === 0) return null;

  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });

  return (
    <View style={[s.card, { backgroundColor: colors.primary + '0F', borderColor: colors.primary + '33' }]}>
      <View style={s.header}>
        <Feather name="eye" size={14} color={colors.primary} />
        <Text style={[s.title, { color: colors.primary }]}>{t.previewTitle}</Text>
      </View>
      {valid.map((r, i) => {
        const color = r.signed ? (r.value >= 0 ? colors.green : colors.red) : colors.text;
        const last = i === valid.length - 1 && r.signed;
        return (
          <View key={r.label} style={[s.row, last && [s.divider, { borderTopColor: colors.border }]]}>
            <Text style={[s.label, { color: colors.mutedForeground }]} numberOfLines={1}>{r.label}</Text>
            <Text style={[s.value, { color }, last && s.valueStrong]} numberOfLines={1} adjustsFontSizeToFit>
              {r.signed && r.value > 0 ? '+' : ''}{fmt(r.value)} {currency}
            </Text>
          </View>
        );
      })}
      {!!note && <Text style={[s.note, { color: colors.mutedForeground }]}>{note}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 2 },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  value: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  valueStrong: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  note: { fontSize: 11.5, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 2 },
});
