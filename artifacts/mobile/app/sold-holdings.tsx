import React, { useMemo } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useSoldHoldings, SoldHolding } from '@/hooks/useSoldHoldings';
import { AssetIcon } from '@/components/AssetIcon';
import { StockLogo } from '@/components/StockLogo';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useDateFormat } from '@/components/rental/RentalUI';

type T = ReturnType<typeof useT>;
type AssetType = 'gold' | 'silver' | 'stock' | 'real_estate' | 'personal_asset' | 'fixed_income';

const ASSET_TYPES: AssetType[] = ['gold', 'silver', 'stock', 'real_estate', 'personal_asset', 'fixed_income'];
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-EG');
const fmtPrice = (n: number) => n.toLocaleString('en-EG', { maximumFractionDigits: 2 });
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmtNum(Math.abs(n))}`;
const pctOf = (gain: number, base: number) => (base > 0 ? `${gain >= 0 ? '+' : '−'}${Math.abs((gain / base) * 100).toFixed(1)}%` : null);

/** Shares and grams can be counted; a flat or a certificate is sold whole. */
const unitFor = (type: string, t: T) => (type === 'stock' ? t.soldUnitShare : type === 'gold' || type === 'silver' ? t.soldUnitGram : null);

function qtyText(type: string, qty: number, t: T): string {
  if (type === 'stock') return `${fmtNum(qty)} ${t.sharesLabel}`;
  if (type === 'gold' || type === 'silver') return `${fmtPrice(qty)} g`;
  return '';
}

function heldText(from: string | null, to: string, t: T): string | null {
  if (!from) return null;
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days < 31) return t.heldDays(days);
  const months = Math.floor(days / 30.44);
  return months < 12 ? t.heldMonths(months) : t.heldYears(Math.floor(months / 12), months % 12);
}

/** Every sale of one investment (same name and type), newest first. */
interface Group {
  key: string;
  label: string;
  type: string;
  sales: SoldHolding[];
  qty: number;
  invested: number;
  received: number;
  gain: number;
}

function groupSales(sold: SoldHolding[]): Group[] {
  const map = new Map<string, Group>();
  for (const s of sold) {
    const key = `${s.type}:${s.label}`;
    const g = map.get(key) ?? { key, label: s.label, type: s.type, sales: [], qty: 0, invested: 0, received: 0, gain: 0 };
    g.sales.push(s);
    g.qty += s.quantity ?? 0;
    g.invested += s.amountInvested;
    g.received += s.saleProceeds;
    g.gain += s.realizedGainLoss;
    map.set(key, g);
  }
  const groups = [...map.values()];
  groups.forEach(g => g.sales.sort((a, b) => b.saleDate.localeCompare(a.saleDate)));
  return groups.sort((a, b) => b.sales[0].saleDate.localeCompare(a.sales[0].saleDate));
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: color ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function SaleDetails({ sale, showResult, hideValues }: { sale: SoldHolding; showResult: boolean; hideValues: boolean }) {
  const colors = useColors();
  const t = useT();
  const fmt = useDateFormat();
  const unit = unitFor(sale.type, t);
  const qty = sale.quantity != null && sale.quantity > 0 ? sale.quantity : null;
  const money = (n: number) => (hideValues ? '••••' : `${fmtNum(n)} EGP`);
  // Per share/gram when it can be counted, otherwise the whole amount.
  const priceText = (total: number) => (hideValues ? '••••'
    : unit && qty ? t.soldPerUnit(fmtPrice(total / qty), unit)
    : `${fmtNum(total)} EGP`);
  const held = heldText(sale.purchaseDate, sale.saleDate, t);
  const gainColor = sale.realizedGainLoss >= 0 ? colors.green : colors.red;
  const pct = pctOf(sale.realizedGainLoss, sale.amountInvested);

  return (
    <View style={[styles.sale, { borderTopColor: colors.border }]}>
      {qty != null && (
        <Text style={[styles.saleQty, { color: colors.text }]}>{qtyText(sale.type, qty, t)}</Text>
      )}
      <Detail
        label={t.soldBoughtLbl}
        value={`${priceText(sale.amountInvested)}${unit && qty && !hideValues ? ` · ${money(sale.amountInvested)}` : ''}${sale.purchaseDate ? ` · ${fmt.full(sale.purchaseDate)}` : ''}`}
      />
      <Detail
        label={t.soldSoldLbl}
        value={`${priceText(sale.saleProceeds)}${unit && qty && !hideValues ? ` · ${money(sale.saleProceeds)}` : ''} · ${fmt.full(sale.saleDate)}`}
      />
      {held && <Detail label={t.soldHeldLbl} value={held} />}
      {showResult && (
        <Detail
          label={t.soldResultLbl}
          value={hideValues ? '••••' : `${signed(sale.realizedGainLoss)} EGP${pct ? ` (${pct})` : ''}`}
          color={gainColor}
        />
      )}
      {!!sale.notes && <Detail label={t.soldNoteLbl} value={sale.notes} />}
    </View>
  );
}

function GroupCard({ group, logoUrl, hideValues }: { group: Group; logoUrl?: string; hideValues: boolean }) {
  const colors = useColors();
  const t = useT();
  const gainColor = group.gain >= 0 ? colors.green : colors.red;
  const pct = pctOf(group.gain, group.invested);
  const assetType = (ASSET_TYPES.includes(group.type as AssetType) ? group.type : 'stock') as AssetType;
  const qty = group.qty > 0 ? qtyText(group.type, group.qty, t) : '';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        {logoUrl ? (
          <StockLogo symbol={group.label} logoUrl={logoUrl} size={40} radius={12} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '17' }]}>
            <AssetIcon type={assetType} size={18} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{group.label}</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {t.soldGroupSub(group.sales.length, qty)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.cardGain, { color: gainColor }]} numberOfLines={1}>
            {hideValues ? '••••' : `${signed(group.gain)} EGP`}
          </Text>
          {pct && (
            <View style={[styles.pctPill, { backgroundColor: gainColor + '1A' }]}>
              <Text style={[styles.pctText, { color: gainColor }]}>{pct}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
        {hideValues ? '••••' : t.soldInvestedReceived(fmtNum(group.invested), fmtNum(group.received))}
      </Text>
      {group.sales.map(sale => (
        <SaleDetails key={sale.id} sale={sale} showResult={group.sales.length > 1} hideValues={hideValues} />
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

export default function SoldHoldingsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { soldHoldings, isLoading, refresh } = useSoldHoldings();
  const { hideValues } = useAppSettings();
  const { data: egx } = useEGXMarket();
  const { data: us } = useGlobalStocks();
  const logoFor = (g: Group) => g.type === 'stock'
    ? (egx?.find(s => s.ticker === g.label)?.logoUrl ?? us?.find(s => s.ticker === g.label)?.logoUrl)
    : undefined;

  const groups = useMemo(() => groupSales(soldHoldings), [soldHoldings]);
  const totalRealized = soldHoldings.reduce((sum, s) => sum + s.realizedGainLoss, 0);
  const totalInvested = soldHoldings.reduce((sum, s) => sum + s.amountInvested, 0);
  const totalReceived = soldHoldings.reduce((sum, s) => sum + s.saleProceeds, 0);
  const totalColor = totalRealized >= 0 ? colors.green : colors.red;
  const totalPct = pctOf(totalRealized, totalInvested);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name={backChevron()} size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.soldInvestments}</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.key}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          soldHoldings.length > 0 ? (
            <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t.totalRealizedPLLabel}</Text>
              <Text style={[styles.totalValue, { color: totalColor }]} numberOfLines={1} adjustsFontSizeToFit>
                {hideValues ? '••••••' : signed(totalRealized)} <Text style={styles.totalCurrency}>EGP</Text>
                {!hideValues && totalPct && <Text style={styles.totalCurrency}>{`  ${totalPct}`}</Text>}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{t.soldAcross(groups.length)}</Text>
              <View style={styles.statRow}>
                <Stat label={t.soldSales} value={String(soldHoldings.length)} />
                <Stat label={t.soldInvested} value={hideValues ? '••••' : fmtNum(totalInvested)} />
                <Stat label={t.soldReceived} value={hideValues ? '••••' : fmtNum(totalReceived)} />
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
                <Feather name="archive" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noSoldInvestmentsTitle}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t.noSoldInvestmentsHint}</Text>
            </View>
          )
        }
        renderItem={({ item }) => <GroupCard group={item} logoUrl={logoFor(item)} hideValues={hideValues} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20 },
  totalCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14, gap: 6 },
  totalLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  totalValue: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  totalCurrency: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stat: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  cardGain: { fontSize: 14.5, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 12.5, fontFamily: 'Inter_400Regular' },
  pctPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pctText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold' },
  sale: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 5 },
  saleQty: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  detailRow: { flexDirection: 'row', gap: 10 },
  detailLabel: { width: 64, fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  detailValue: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  emptyWrap: {
    borderRadius: 24, padding: 40, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 20,
  },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
});
