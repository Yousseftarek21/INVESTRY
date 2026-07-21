/**
 * Financial Tools — calculator grid + modals
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { Holding, MarketPrices } from '@/types';
import { getRECurrentValue } from '@/utils/rePrice';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return getRECurrentValue(h);
  return 0;
}
function computeCost(h: Holding): number {
  if (h.type === 'gold') return h.grams * h.purchasePricePerGram;
  if (h.type === 'silver') return h.grams * h.purchasePricePerGram;
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.purchasePrice;
  return 0;
}
function fmt(n: number, dec = 0) {
  return Math.abs(n).toLocaleString('en-EG', { maximumFractionDigits: dec, minimumFractionDigits: dec });
}
function parseNum(s: string) { return parseFloat(s.replace(/,/g, '')) || 0; }

// ─── Shared Modal Shell ────────────────────────────────────────────────────────

type ModalIcon = keyof typeof Feather.glyphMap | { lib: 'mci'; name: string };
function ModalShell({
  visible, title, icon, iconColor, onClose, children,
}: {
  visible: boolean; title: string; icon: ModalIcon;
  iconColor: string; onClose: () => void; children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 20, stiffness: 120 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={sh.overlay}>
        {/* Tappable backdrop — closes when user taps outside the sheet */}
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={sh.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[sh.sheet, {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateY: slideAnim }],
            }]}
          >
            {/* Handle */}
            <View style={[sh.handle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={sh.header}>
              <View style={[sh.iconWrap, { backgroundColor: iconColor + '18' }]}>
                {typeof icon === 'object' && icon.lib === 'mci'
                  ? <MaterialCommunityIcons name={icon.name as any} size={18} color={iconColor} />
                  : <Feather name={icon as keyof typeof Feather.glyphMap} size={18} color={iconColor} />}
              </View>
              <Text style={[sh.title, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={[sh.closeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={sh.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const sh = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold' },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
});

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function CalcInput({ label, value, onChange, placeholder, unit, keyboardType = 'numeric' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; unit?: string; keyboardType?: 'numeric' | 'default';
}) {
  const colors = useColors();
  return (
    <View style={ci.wrap}>
      <Text style={[ci.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[ci.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[ci.input, { color: colors.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
        />
        {unit ? <Text style={[ci.unit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}
const ci = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, height: 48, fontSize: 16, fontFamily: 'Inter_400Regular' },
  unit: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});

function ResultCard({ rows }: { rows: { label: string; value: string; highlight?: boolean }[] }) {
  const colors = useColors();
  return (
    <View style={[rc.card, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}>
      <View style={[rc.accentBar, { backgroundColor: colors.primary }]} />
      {rows.map((r, i) => (
        <View key={i} style={[rc.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[rc.label, { color: colors.mutedForeground }]}>{r.label}</Text>
          <Text style={[rc.value, { color: r.highlight ? colors.primary : colors.text }]}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}
const rc = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  accentBar: { height: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  value: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});

function SegPicker<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[sp.row, { backgroundColor: colors.muted, borderRadius: 14 }]}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[sp.btn, active && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
          >
            <Text style={[sp.label, { color: active ? colors.primary : colors.mutedForeground }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const sp = StyleSheet.create({
  row: { flexDirection: 'row', padding: 3 },
  btn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 11 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

function Disclaimer({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={[dis.wrap, { backgroundColor: colors.muted, borderRadius: 12 }]}>
      <Feather name="info" size={12} color={colors.mutedForeground} />
      <Text style={[dis.text, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}
const dis = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12 },
  text: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});

// ─── 1. Zakat Calculator ──────────────────────────────────────────────────────

function ZakatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const t = useT();
  const { holdings } = useHoldings();
  const { data: prices } = useMarketPrices();
  const [nisabType, setNisabType] = useState<'gold' | 'silver'>('gold');
  const [includeStocks, setIncludeStocks] = useState(false);
  const [extraCash, setExtraCash] = useState('');

  const goldGramsNisab = 85;   // 85g of 24k gold
  const silverGramsNisab = 595; // 595g of silver

  const liveGold24 = prices ? goldPricePerGram(prices, '24k') : 0;
  const liveSilver = prices ? silverPricePerGram(prices) : 0;

  const nisabValue = nisabType === 'gold'
    ? goldGramsNisab * liveGold24
    : silverGramsNisab * liveSilver;

  const goldWealth = holdings
    .filter(h => h.type === 'gold')
    .reduce((s, h) => s + (prices ? computeValue(h, prices) : 0), 0);

  const silverWealth = holdings
    .filter(h => h.type === 'silver')
    .reduce((s, h) => s + (prices ? computeValue(h, prices) : 0), 0);

  const stockWealth = includeStocks
    ? holdings.filter(h => h.type === 'stock').reduce((s, h) => s + computeCost(h), 0)
    : 0;

  const cashWealth = parseNum(extraCash);
  const totalZakatable = goldWealth + silverWealth + stockWealth + cashWealth;
  const eligible = totalZakatable >= nisabValue && nisabValue > 0;
  const zakatDue = eligible ? totalZakatable * 0.025 : 0;

  const nisabStr = nisabValue > 0 ? `${fmt(nisabValue)} EGP` : t.nisabNoLivePrice;

  return (
    <ModalShell visible={visible} title={t.zakatModalTitle} icon="moon" iconColor="#10B981" onClose={onClose}>
      <SegPicker
        options={[{ key: 'gold', label: t.goldNisabOption }, { key: 'silver', label: t.silverNisabOption }]}
        value={nisabType}
        onChange={setNisabType}
      />

      <View style={[zk.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[zk.infoLabel, { color: colors.mutedForeground }]}>
          {t.currentNisabLabel(nisabType === 'gold' ? t.nisab85gGold : t.nisab595gSilver)}
        </Text>
        <Text style={[zk.infoVal, { color: colors.primary }]}>{nisabStr}</Text>
      </View>

      <Text style={[zk.sectionTitle, { color: colors.text }]}>{t.eligibleAssetsDetected}</Text>

      <View style={[zk.assetList, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: t.gold,   value: goldWealth,   icon: { lib: 'mci', name: 'gold' } as const, color: colors.primary },
          { label: t.silver, value: silverWealth, icon: { lib: 'mci', name: 'gold' } as const, color: colors.silverColor },
        ].map((item, i) => (
          <View key={i} style={[zk.assetRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[zk.assetIcon, { backgroundColor: item.color + '18' }]}>
              <MaterialCommunityIcons name="gold" size={13} color={item.color} />
            </View>
            <Text style={[zk.assetLabel, { color: colors.text }]}>{item.label}</Text>
            <Text style={[zk.assetVal, { color: colors.text }]}>{fmt(item.value)} EGP</Text>
          </View>
        ))}
        <View style={[zk.assetRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[zk.assetIcon, { backgroundColor: '#4A9EFF18' }]}>
            <Feather name="bar-chart-2" size={13} color="#4A9EFF" />
          </View>
          <Text style={[zk.assetLabel, { color: colors.text }]}>{t.egxStocksAllocLabel}</Text>
          <Pressable onPress={() => setIncludeStocks(v => !v)} style={[zk.toggle, { backgroundColor: includeStocks ? colors.primary + '22' : colors.muted }]}>
            <Text style={[zk.toggleTxt, { color: includeStocks ? colors.primary : colors.mutedForeground }]}>
              {includeStocks ? t.includedLabel : t.excludedLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      <CalcInput label={t.additionalCashLabel} value={extraCash} onChange={setExtraCash} placeholder="0" unit="EGP" />

      <ResultCard rows={[
        { label: t.totalZakatableWealth, value: `${fmt(totalZakatable)} EGP` },
        { label: t.nisabThresholdLabel, value: nisabStr },
        { label: t.nisabMetLabel, value: eligible ? t.nisabMetYes : nisabValue > 0 ? t.nisabMetNoBelowNisab : t.nisabNoLivePrice },
        { label: t.zakatDueLabel, value: eligible ? `${fmt(zakatDue)} EGP` : '—', highlight: eligible },
      ]} />

      <Disclaimer text={t.zakatDisclaimer} />
    </ModalShell>
  );
}
const zk = StyleSheet.create({
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14 },
  infoLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoVal: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  assetList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  assetIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  assetLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  assetVal: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  toggle: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  toggleTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});

// ─── 2. Gold Value Calculator ─────────────────────────────────────────────────

function GoldValueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { data: prices } = useMarketPrices();
  const [grams, setGrams] = useState('');
  const [karat, setKarat] = useState<'24k' | '22k' | '21k' | '18k'>('21k');
  const pricePerGram = prices ? goldPricePerGram(prices, karat) : 0;
  const value = parseNum(grams) * pricePerGram;

  return (
    <ModalShell visible={visible} title={t.goldValueModalTitle} icon={{ lib: 'mci', name: 'gold' }} iconColor="#C9A227" onClose={onClose}>
      <SegPicker
        options={[{ key: '24k', label: '24K' }, { key: '22k', label: '22K' }, { key: '21k', label: '21K' }, { key: '18k', label: '18K' }]}
        value={karat}
        onChange={setKarat}
      />
      <CalcInput label={t.weightGramsLabel} value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: t.livePriceKaratLabel(karat.toUpperCase()), value: pricePerGram > 0 ? `${fmt(pricePerGram, 2)} EGP/g` : t.calcLoading },
        { label: t.totalValueLabel, value: value > 0 ? `${fmt(value)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 3. Silver Value Calculator ───────────────────────────────────────────────

function SilverValueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { data: prices } = useMarketPrices();
  const [grams, setGrams] = useState('');
  const pricePerGram = prices ? silverPricePerGram(prices) : 0;
  const value = parseNum(grams) * pricePerGram;

  return (
    <ModalShell visible={visible} title={t.silverValueModalTitle} icon={{ lib: 'mci', name: 'gold' }} iconColor="#C0C8D4" onClose={onClose}>
      <CalcInput label={t.weightGramsLabel} value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: t.livePriceLabel, value: pricePerGram > 0 ? `${fmt(pricePerGram, 2)} EGP/g` : t.calcLoading },
        { label: t.totalValueLabel, value: value > 0 ? `${fmt(value)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 4. Currency Converter ────────────────────────────────────────────────────

function CurrencyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { data: prices } = useMarketPrices();
  const [amount, setAmount] = useState('');
  const [dir, setDir] = useState<'egpToUsd' | 'usdToEgp'>('usdToEgp');
  const rate = prices?.usdToEgp ?? 0;
  const converted = dir === 'usdToEgp' ? parseNum(amount) * rate : rate > 0 ? parseNum(amount) / rate : 0;
  const fromCur = dir === 'usdToEgp' ? 'USD' : 'EGP';
  const toCur = dir === 'usdToEgp' ? 'EGP' : 'USD';

  return (
    <ModalShell visible={visible} title={t.currencyModalTitle} icon="refresh-cw" iconColor="#4A9EFF" onClose={onClose}>
      <SegPicker
        options={[{ key: 'usdToEgp', label: t.usdToEgpOption }, { key: 'egpToUsd', label: t.egpToUsdOption }]}
        value={dir}
        onChange={setDir}
      />
      <CalcInput label={t.amountCurLabel(fromCur)} value={amount} onChange={setAmount} unit={fromCur} />
      <ResultCard rows={[
        { label: t.usdEgpRateLabel, value: rate > 0 ? `${rate.toFixed(3)}` : t.calcLoading },
        { label: t.resultCurLabel(toCur), value: converted > 0 ? fmt(converted, 2) : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 5. ROI Calculator ────────────────────────────────────────────────────────

function ROIModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [cost, setCost] = useState('');
  const [current, setCurrent] = useState('');
  const [years, setYears] = useState('');
  const c = parseNum(cost), v = parseNum(current), y = parseNum(years);
  const gain = v - c;
  const roi = c > 0 ? (gain / c) * 100 : 0;
  const annualized = c > 0 && v > 0 && y > 0 ? (Math.pow(v / c, 1 / y) - 1) * 100 : 0;

  return (
    <ModalShell visible={visible} title={t.roiModalTitle} icon="trending-up" iconColor="#00D4AA" onClose={onClose}>
      <CalcInput label={t.purchaseCostLabel} value={cost} onChange={setCost} unit="EGP" />
      <CalcInput label={t.currentValueLabel} value={current} onChange={setCurrent} unit="EGP" />
      <CalcInput label={t.holdingPeriodLabel} value={years} onChange={setYears} unit="yrs" />
      <ResultCard rows={[
        { label: t.gainLossLabel, value: gain !== 0 ? `${gain >= 0 ? '+' : '−'}${fmt(gain)} EGP` : '—' },
        { label: t.totalReturnLabel, value: roi !== 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '—', highlight: roi > 0 },
        { label: t.annualizedReturnLabel, value: y > 0 && annualized !== 0 ? `${annualized >= 0 ? '+' : ''}${annualized.toFixed(2)}%/yr` : '—' },
      ]} />
    </ModalShell>
  );
}

// ─── 6. Compound Growth Calculator ───────────────────────────────────────────

function CompoundModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const [monthly, setMonthly] = useState('');
  const [freq, setFreq] = useState<'1' | '12'>('12');
  const P = parseNum(principal), r = parseNum(rate) / 100, n = parseNum(freq), yrs = parseNum(years), m = parseNum(monthly);
  const final = P * Math.pow(1 + r / n, n * yrs) + (m > 0 && r > 0 ? m * ((Math.pow(1 + r / n, n * yrs) - 1) / (r / n)) : 0);
  const totalContrib = P + m * 12 * yrs;
  const growth = final - totalContrib;

  return (
    <ModalShell visible={visible} title={t.compoundModalTitle} icon="bar-chart-2" iconColor="#A47FCA" onClose={onClose}>
      <SegPicker
        options={[{ key: '12', label: t.compoundMonthlyOption }, { key: '1', label: t.compoundYearlyOption }]}
        value={freq}
        onChange={setFreq}
      />
      <CalcInput label={t.initialInvestmentLabel} value={principal} onChange={setPrincipal} unit="EGP" />
      <CalcInput label={t.annualReturnRateLabel} value={rate} onChange={setRate} unit="%" />
      <CalcInput label={t.durationYearsLabel} value={years} onChange={setYears} unit="yrs" />
      <CalcInput label={t.monthlyContributionLabel} value={monthly} onChange={setMonthly} placeholder="0" unit="EGP" />
      <ResultCard rows={[
        { label: t.totalContributionsLabel, value: totalContrib > 0 ? `${fmt(totalContrib)} EGP` : '—' },
        { label: t.growthFromReturnsLabel, value: growth > 0 ? `${fmt(growth)} EGP` : '—' },
        { label: t.finalValueLabel, value: final > 0 ? `${fmt(final)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 7. Gold Purity Converter ─────────────────────────────────────────────────

function GoldPurityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [grams, setGrams] = useState('');
  const [fromK, setFromK] = useState<'24' | '22' | '21' | '18'>('21');
  const purities: Record<string, number> = { '24': 1, '22': 22/24, '21': 21/24, '18': 18/24 };
  const pureGold = parseNum(grams) * purities[fromK];

  return (
    <ModalShell visible={visible} title={t.goldPurityModalTitle} icon={{ lib: 'mci', name: 'gold' }} iconColor="#C9A227" onClose={onClose}>
      <SegPicker
        options={[{ key: '24', label: '24K' }, { key: '22', label: '22K' }, { key: '21', label: '21K' }, { key: '18', label: '18K' }]}
        value={fromK}
        onChange={setFromK}
      />
      <CalcInput label={t.weightInKaratLabel(fromK)} value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: t.equivalentIn24k, value: pureGold > 0 ? `${pureGold.toFixed(3)} g` : '—', highlight: true },
        { label: t.equivalentIn22k, value: pureGold > 0 ? `${(pureGold / (22/24)).toFixed(3)} g` : '—' },
        { label: t.equivalentIn21k, value: pureGold > 0 ? `${(pureGold / (21/24)).toFixed(3)} g` : '—' },
        { label: t.equivalentIn18k, value: pureGold > 0 ? `${(pureGold / (18/24)).toFixed(3)} g` : '—' },
      ]} />
    </ModalShell>
  );
}

// ─── 8. Gram ↔ Troy Oz ───────────────────────────────────────────────────────

function WeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [amount, setAmount] = useState('');
  const [dir, setDir] = useState<'gToOz' | 'ozToG'>('gToOz');
  const TROY_OZ = 31.1035;
  const result = dir === 'gToOz' ? parseNum(amount) / TROY_OZ : parseNum(amount) * TROY_OZ;
  const fromUnit = dir === 'gToOz' ? 'grams' : 'troy oz';
  const toUnit = dir === 'gToOz' ? 'troy oz' : 'grams';

  return (
    <ModalShell visible={visible} title={t.weightModalTitle} icon="maximize-2" iconColor="#F59E0B" onClose={onClose}>
      <SegPicker
        options={[{ key: 'gToOz', label: t.gToOzOption }, { key: 'ozToG', label: t.ozToGOption }]}
        value={dir}
        onChange={setDir}
      />
      <CalcInput label={t.amountCurLabel(fromUnit)} value={amount} onChange={setAmount} unit={dir === 'gToOz' ? 'g' : 'oz'} />
      <ResultCard rows={[
        { label: t.resultCurLabel(toUnit), value: result > 0 ? `${result.toFixed(4)} ${toUnit}` : '—', highlight: true },
        { label: t.oneTroyOzEquals, value: t.troyOzGramsValue },
      ]} />
    </ModalShell>
  );
}

// ─── Tool grid ─────────────────────────────────────────────────────────────────

function getTools(t: ReturnType<typeof useT>) {
  return [
    { id: 'zakat',    icon: 'moon',         label: t.toolZakatLabel,    sub: t.toolZakatSub,     color: '#10B981' },
    { id: 'gold',     icon: { lib: 'mci', name: 'gold' } as const, label: t.toolGoldLabel,   sub: t.toolLivePriceSub, color: '#C9A227' },
    { id: 'silver',   icon: { lib: 'mci', name: 'gold' } as const, label: t.toolSilverLabel, sub: t.toolLivePriceSub, color: '#C0C8D4' },
    { id: 'currency', icon: 'refresh-cw',   label: t.toolCurrencyLabel, sub: t.toolCurrencySub,  color: '#4A9EFF' },
    { id: 'roi',      icon: 'trending-up',  label: t.toolROILabel,      sub: t.toolROISub,       color: '#00D4AA' },
    { id: 'compound', icon: 'bar-chart-2',  label: t.toolCompoundLabel, sub: t.toolCompoundSub,  color: '#A47FCA' },
    { id: 'purity',   icon: { lib: 'mci', name: 'gold' } as const, label: t.toolPurityLabel, sub: t.toolPuritySub,   color: '#C9A227' },
    { id: 'weight',   icon: 'maximize-2',   label: t.toolWeightLabel,   sub: t.toolWeightSub,    color: '#F59E0B' },
  ] as const;
}
type ToolId = ReturnType<typeof getTools>[number]['id'];

function ToolCard({ tool, onPress }: { tool: ReturnType<typeof getTools>[number]; onPress: () => void }) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: Platform.OS !== 'web' }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[tc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Coloured top accent */}
        <View style={[tc.topAccent, { backgroundColor: tool.color }]} />
        {/* Icon */}
        <View style={[tc.iconWrap, { backgroundColor: tool.color + '1A' }]}>
          {typeof tool.icon === 'object' && tool.icon.lib === 'mci'
            ? <MaterialCommunityIcons name={tool.icon.name as any} size={22} color={tool.color} />
            : <Feather name={tool.icon as any} size={22} color={tool.color} />}
        </View>
        {/* Label */}
        <Text style={[tc.label, { color: colors.text }]} numberOfLines={1}>{tool.label}</Text>
        {/* Sub */}
        <Text style={[tc.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{tool.sub}</Text>
      </Pressable>
    </Animated.View>
  );
}
const tc = StyleSheet.create({
  card: {
    width: 100,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  sub: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});

// ─── Main export ───────────────────────────────────────────────────────────────

export function FinancialTools() {
  const t = useT();
  const [open, setOpen] = useState<ToolId | null>(null);
  const tools = getTools(t);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ft.wrap}
        contentContainerStyle={ft.row}
      >
        {tools.map(tool => (
          <ToolCard key={tool.id} tool={tool} onPress={() => setOpen(tool.id)} />
        ))}
      </ScrollView>

      {/* Modals */}
      <ZakatModal      visible={open === 'zakat'}    onClose={() => setOpen(null)} />
      <GoldValueModal  visible={open === 'gold'}     onClose={() => setOpen(null)} />
      <SilverValueModal visible={open === 'silver'}  onClose={() => setOpen(null)} />
      <CurrencyModal   visible={open === 'currency'} onClose={() => setOpen(null)} />
      <ROIModal        visible={open === 'roi'}      onClose={() => setOpen(null)} />
      <CompoundModal   visible={open === 'compound'} onClose={() => setOpen(null)} />
      <GoldPurityModal visible={open === 'purity'}   onClose={() => setOpen(null)} />
      <WeightModal     visible={open === 'weight'}   onClose={() => setOpen(null)} />
    </>
  );
}
const ft = StyleSheet.create({
  wrap: { marginHorizontal: -20 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
});
