import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { goldPricePerGram, useMarketPrices } from '@/hooks/usePrices';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useRealEstatePrices } from '@/hooks/useRealEstatePrices';

// Miniature versions of real INVESTRY screens for the welcome slides. The
// prices and property rows are live (public endpoints, no account needed);
// the portfolio and rental cards are clearly marked examples.

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { language } = useAppSettings();
  return <Text style={[s.eyebrow, language === 'ar' && s.eyebrowAr, { color: colors.mutedForeground }]}>{children}</Text>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color + '1F' }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Row({ icon, iconColor, label, value, sub, valueColor }: {
  icon: keyof typeof Feather.glyphMap; iconColor: string; label: string; value: string; sub?: string; valueColor?: string;
}) {
  const colors = useColors();
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: iconColor + '1A' }]}>
        <Feather name={icon} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowLabel, { color: colors.text }]} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={[s.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>}
      </View>
      <Text style={[s.rowValue, { color: valueColor ?? colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Slide 1 — one number for everything (example). */
export function PortfolioPreview() {
  const colors = useColors();
  const t = useT();
  const parts = [
    { label: t.realEstate, pct: 46, color: '#A47FCA' },
    { label: t.gold, pct: 28, color: colors.primary },
    { label: t.egxStocksAllocLabel, pct: 16, color: '#4A9EFF' },
    { label: t.obCash, pct: 10, color: colors.green },
  ];
  return (
    <Card>
      <View style={s.headRow}>
        <Eyebrow>{t.homeNetWorth.toUpperCase()}</Eyebrow>
        <Badge label={t.obExample} color={colors.mutedForeground} />
      </View>
      <Text style={[s.big, { color: colors.text }]}>2,486,300 <Text style={[s.bigUnit, { color: colors.primary }]}>EGP</Text></Text>
      <Text style={[s.change, { color: colors.green }]}>+12,840 EGP {t.obToday}</Text>
      <View style={s.bar}>
        {parts.map(p => <View key={p.label} style={{ flex: p.pct, backgroundColor: p.color }} />)}
      </View>
      <View style={s.legend}>
        {parts.map(p => (
          <View key={p.label} style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: p.color }]} />
            <Text style={[s.legendText, { color: colors.mutedForeground }]}>{p.label} {p.pct}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Slide 2 — today's real prices. */
export function LivePricesPreview() {
  const colors = useColors();
  const t = useT();
  const { data: prices, isPlaceholderData } = useMarketPrices();
  const { data: egx } = useEGXMarket();
  const ready = !!prices && !isPlaceholderData;
  const g21 = ready ? goldPricePerGram(prices, '21k') : NaN;
  const g24 = ready ? goldPricePerGram(prices, '24k') : NaN;
  const usd = ready ? prices.usdToEgp : NaN;
  const mover = (egx ?? [])
    .filter(x => Number.isFinite(x.changePercent) && x.price > 0)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];
  const show = (n: number, digits = 0) => (Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—');

  return (
    <Card>
      <View style={s.headRow}>
        <Eyebrow>{t.obPricesToday}</Eyebrow>
        <Badge label="LIVE" color={colors.green} />
      </View>
      <Row icon="star" iconColor={colors.primary} label={t.obGold21} value={`${show(g21)} EGP`} sub={t.previewPerGram} />
      <Row icon="star" iconColor={colors.primary} label={t.obGold24} value={`${show(g24)} EGP`} sub={t.previewPerGram} />
      <Row icon="dollar-sign" iconColor={colors.green} label="USD → EGP" value={show(usd, 2)} />
      {mover && (
        <Row
          icon={mover.changePercent >= 0 ? 'trending-up' : 'trending-down'}
          iconColor={mover.changePercent >= 0 ? colors.green : colors.red}
          label={mover.ticker}
          sub={t.obTopMover}
          value={`${mover.changePercent >= 0 ? '+' : ''}${mover.changePercent.toFixed(2)}%`}
          valueColor={mover.changePercent >= 0 ? colors.green : colors.red}
        />
      )}
    </Card>
  );
}

const AREA_IDS = ['cairo-new-cairo', 'giza-sheikh-zayed', 'cairo-new-capital', 'cairo-zamalek'];

/** Slide 3 — real price per m² by area. */
export function PropertyPreview() {
  const colors = useColors();
  const t = useT();
  const { data: areas } = useRealEstatePrices();
  const rows = AREA_IDS
    .map(id => areas?.find(a => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a && a.avgPricePerM2 != null && a.avgPricePerM2 > 0)
    .slice(0, 3);
  return (
    <Card>
      <View style={s.headRow}>
        <Eyebrow>{t.obPricePerM2}</Eyebrow>
        <Badge label="LIVE" color={colors.green} />
      </View>
      {rows.length > 0 ? rows.map(a => (
        <Row key={a.id} icon="home" iconColor="#A47FCA" label={a.area} sub={a.governorate} value={`${fmt(a.avgPricePerM2!)} EGP`} />
      )) : [0, 1, 2].map(i => (
        <Row key={i} icon="home" iconColor="#A47FCA" label="—" value="— EGP" />
      ))}
      <Text style={[s.foot, { color: colors.mutedForeground }]}>{t.obFromListings}</Text>
    </Card>
  );
}

/** Slide 4 — a rental unit's month (example). */
export function RentalPreview() {
  const colors = useColors();
  const t = useT();
  return (
    <Card>
      <View style={s.headRow}>
        <Eyebrow>{t.rpHomeCardTitle.toUpperCase()}</Eyebrow>
        <Badge label={t.obExample} color={colors.mutedForeground} />
      </View>
      <Text style={[s.big, { color: colors.text }]}>18,400 <Text style={[s.bigUnit, { color: colors.primary }]}>EGP</Text></Text>
      <Text style={[s.change, { color: colors.mutedForeground }]}>{t.obRentalExampleSub}</Text>
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Row icon="log-in" iconColor={colors.primary} label={t.obRentalExampleUnit} sub={t.cuCheckIn('Mona')} value={t.cuTomorrow} valueColor={colors.primary} />
      <Row icon="key" iconColor="#F59E0B" label={t.obRentalExampleFlat} sub={t.cuRentDue('12,000 EGP')} value={t.obInDays(3)} />
    </Card>
  );
}

/** Slide 5 — smart tools and privacy. */
export function SmartPrivatePreview() {
  const colors = useColors();
  const t = useT();
  return (
    <Card>
      <Row icon="cpu" iconColor="#4A9EFF" label={t.obSmartAi} sub={t.obSmartAiSub} value="" />
      <Row icon="heart" iconColor={colors.green} label={t.obSmartHealth} sub={t.obSmartHealthSub} value="" />
      <Row icon="bell" iconColor="#F59E0B" label={t.obSmartAlerts} sub={t.obSmartAlertsSub} value="" />
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <View style={s.privacyRow}>
        <Feather name="shield" size={14} color={colors.green} />
        <Text style={[s.foot, { color: colors.mutedForeground, flex: 1, marginTop: 0 }]}>{t.obPrivacyLine}</Text>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { width: '100%', borderRadius: 22, borderWidth: 1, padding: 16, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  // Arabic is cursive — letter-spacing pulls joined letters apart.
  eyebrowAr: { letterSpacing: 0, fontSize: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  big: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  bigUnit: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  change: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: -6 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11.5, fontFamily: 'Inter_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 11.5, fontFamily: 'Inter_400Regular', marginTop: 1 },
  rowValue: { fontSize: 13.5, fontFamily: 'Inter_700Bold' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  foot: { fontSize: 11.5, fontFamily: 'Inter_400Regular', lineHeight: 16, marginTop: 2 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
