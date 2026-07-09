/**
 * Financial Tools — calculator grid + modals
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useHoldings } from '@/context/HoldingsContext';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { Holding, MarketPrices } from '@/types';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function computeValue(h: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (h.type === 'gold') return h.grams * goldPricePerGram(prices, h.karat);
  if (h.type === 'silver') return h.grams * silverPricePerGram(prices);
  if (h.type === 'stock') return h.shares * h.purchasePricePerShare;
  if (h.type === 'real_estate') return h.currentValue;
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

function ModalShell({
  visible, title, icon, iconColor, onClose, children,
}: {
  visible: boolean; title: string; icon: keyof typeof Feather.glyphMap;
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
      <View style={[sh.overlay, { backgroundColor: colors.overlay }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={sh.kav}
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
                <Feather name={icon} size={18} color={iconColor} />
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

  const nisabStr = nisabValue > 0 ? `${fmt(nisabValue)} EGP` : 'N/A (no live price)';

  return (
    <ModalShell visible={visible} title="Smart Zakat Calculator" icon="moon" iconColor="#10B981" onClose={onClose}>
      <SegPicker
        options={[{ key: 'gold', label: 'Gold Nisab' }, { key: 'silver', label: 'Silver Nisab' }]}
        value={nisabType}
        onChange={setNisabType}
      />

      <View style={[zk.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[zk.infoLabel, { color: colors.mutedForeground }]}>
          Current Nisab ({nisabType === 'gold' ? '85g gold' : '595g silver'})
        </Text>
        <Text style={[zk.infoVal, { color: colors.primary }]}>{nisabStr}</Text>
      </View>

      <Text style={[zk.sectionTitle, { color: colors.text }]}>Eligible Assets Detected</Text>

      <View style={[zk.assetList, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: 'Gold', value: goldWealth, icon: 'award' as const, color: colors.primary },
          { label: 'Silver', value: silverWealth, icon: 'circle' as const, color: colors.silverColor },
        ].map((item, i) => (
          <View key={i} style={[zk.assetRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[zk.assetIcon, { backgroundColor: item.color + '18' }]}>
              <Feather name={item.icon} size={13} color={item.color} />
            </View>
            <Text style={[zk.assetLabel, { color: colors.text }]}>{item.label}</Text>
            <Text style={[zk.assetVal, { color: colors.text }]}>{fmt(item.value)} EGP</Text>
          </View>
        ))}
        <View style={[zk.assetRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[zk.assetIcon, { backgroundColor: '#4A9EFF18' }]}>
            <Feather name="bar-chart-2" size={13} color="#4A9EFF" />
          </View>
          <Text style={[zk.assetLabel, { color: colors.text }]}>EGX Stocks</Text>
          <Pressable onPress={() => setIncludeStocks(v => !v)} style={[zk.toggle, { backgroundColor: includeStocks ? colors.primary + '22' : colors.muted }]}>
            <Text style={[zk.toggleTxt, { color: includeStocks ? colors.primary : colors.mutedForeground }]}>
              {includeStocks ? 'Included' : 'Excluded'}
            </Text>
          </Pressable>
        </View>
      </View>

      <CalcInput label="Additional Cash / Savings (EGP)" value={extraCash} onChange={setExtraCash} placeholder="0" unit="EGP" />

      <ResultCard rows={[
        { label: 'Total Zakatable Wealth', value: `${fmt(totalZakatable)} EGP` },
        { label: 'Nisab Threshold', value: nisabStr },
        { label: 'Nisab Met?', value: eligible ? 'Yes ✓' : nisabValue > 0 ? 'No — below nisab' : 'No live price' },
        { label: 'Zakat Due (2.5%)', value: eligible ? `${fmt(zakatDue)} EGP` : '—', highlight: eligible },
      ]} />

      <Disclaimer text="Zakat calculations are estimates based on your tracked assets. Actual obligations may differ based on your specific circumstances, lunar year holding period (hawl), and the scholarly opinion you follow. Please consult a qualified Islamic scholar for definitive rulings." />
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
  const { data: prices } = useMarketPrices();
  const [grams, setGrams] = useState('');
  const [karat, setKarat] = useState<'24k' | '22k' | '21k' | '18k'>('21k');
  const pricePerGram = prices ? goldPricePerGram(prices, karat) : 0;
  const value = parseNum(grams) * pricePerGram;

  return (
    <ModalShell visible={visible} title="Gold Value Calculator" icon="award" iconColor="#C9A227" onClose={onClose}>
      <SegPicker
        options={[{ key: '24k', label: '24K' }, { key: '22k', label: '22K' }, { key: '21k', label: '21K' }, { key: '18k', label: '18K' }]}
        value={karat}
        onChange={setKarat}
      />
      <CalcInput label="Weight (grams)" value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: `Live Price (${karat.toUpperCase()})`, value: pricePerGram > 0 ? `${fmt(pricePerGram, 2)} EGP/g` : 'Loading…' },
        { label: 'Total Value', value: value > 0 ? `${fmt(value)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 3. Silver Value Calculator ───────────────────────────────────────────────

function SilverValueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: prices } = useMarketPrices();
  const [grams, setGrams] = useState('');
  const pricePerGram = prices ? silverPricePerGram(prices) : 0;
  const value = parseNum(grams) * pricePerGram;

  return (
    <ModalShell visible={visible} title="Silver Value Calculator" icon="circle" iconColor="#C0C8D4" onClose={onClose}>
      <CalcInput label="Weight (grams)" value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: 'Live Price', value: pricePerGram > 0 ? `${fmt(pricePerGram, 2)} EGP/g` : 'Loading…' },
        { label: 'Total Value', value: value > 0 ? `${fmt(value)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 4. Currency Converter ────────────────────────────────────────────────────

function CurrencyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data: prices } = useMarketPrices();
  const [amount, setAmount] = useState('');
  const [dir, setDir] = useState<'egpToUsd' | 'usdToEgp'>('usdToEgp');
  const rate = prices?.usdToEgp ?? 0;
  const converted = dir === 'usdToEgp' ? parseNum(amount) * rate : rate > 0 ? parseNum(amount) / rate : 0;
  const fromCur = dir === 'usdToEgp' ? 'USD' : 'EGP';
  const toCur = dir === 'usdToEgp' ? 'EGP' : 'USD';

  return (
    <ModalShell visible={visible} title="Currency Converter" icon="refresh-cw" iconColor="#4A9EFF" onClose={onClose}>
      <SegPicker
        options={[{ key: 'usdToEgp', label: 'USD → EGP' }, { key: 'egpToUsd', label: 'EGP → USD' }]}
        value={dir}
        onChange={setDir}
      />
      <CalcInput label={`Amount (${fromCur})`} value={amount} onChange={setAmount} unit={fromCur} />
      <ResultCard rows={[
        { label: 'USD/EGP Rate', value: rate > 0 ? `${rate.toFixed(3)}` : 'Loading…' },
        { label: `Result (${toCur})`, value: converted > 0 ? fmt(converted, 2) : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 5. ROI Calculator ────────────────────────────────────────────────────────

function ROIModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [cost, setCost] = useState('');
  const [current, setCurrent] = useState('');
  const [years, setYears] = useState('');
  const c = parseNum(cost), v = parseNum(current), y = parseNum(years);
  const gain = v - c;
  const roi = c > 0 ? (gain / c) * 100 : 0;
  const annualized = c > 0 && v > 0 && y > 0 ? (Math.pow(v / c, 1 / y) - 1) * 100 : 0;

  return (
    <ModalShell visible={visible} title="ROI Calculator" icon="trending-up" iconColor="#00D4AA" onClose={onClose}>
      <CalcInput label="Purchase Cost (EGP)" value={cost} onChange={setCost} unit="EGP" />
      <CalcInput label="Current Value (EGP)" value={current} onChange={setCurrent} unit="EGP" />
      <CalcInput label="Holding Period (years)" value={years} onChange={setYears} unit="yrs" />
      <ResultCard rows={[
        { label: 'Gain / Loss', value: gain !== 0 ? `${gain >= 0 ? '+' : '−'}${fmt(gain)} EGP` : '—' },
        { label: 'Total Return', value: roi !== 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '—', highlight: roi > 0 },
        { label: 'Annualized Return', value: y > 0 && annualized !== 0 ? `${annualized >= 0 ? '+' : ''}${annualized.toFixed(2)}%/yr` : '—' },
      ]} />
    </ModalShell>
  );
}

// ─── 6. Compound Growth Calculator ───────────────────────────────────────────

function CompoundModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const [monthly, setMonthly] = useState('');
  const [freq, setFreq] = useState<'1' | '12'>('12');
  const P = parseNum(principal), r = parseNum(rate) / 100, n = parseNum(freq), t = parseNum(years), m = parseNum(monthly);
  const final = P * Math.pow(1 + r / n, n * t) + (m > 0 && r > 0 ? m * ((Math.pow(1 + r / n, n * t) - 1) / (r / n)) : 0);
  const totalContrib = P + m * 12 * t;
  const growth = final - totalContrib;

  return (
    <ModalShell visible={visible} title="Compound Growth" icon="bar-chart-2" iconColor="#A47FCA" onClose={onClose}>
      <SegPicker
        options={[{ key: '12', label: 'Monthly' }, { key: '1', label: 'Yearly' }]}
        value={freq}
        onChange={setFreq}
      />
      <CalcInput label="Initial Investment (EGP)" value={principal} onChange={setPrincipal} unit="EGP" />
      <CalcInput label="Annual Return Rate (%)" value={rate} onChange={setRate} unit="%" />
      <CalcInput label="Duration (years)" value={years} onChange={setYears} unit="yrs" />
      <CalcInput label="Monthly Contribution (EGP)" value={monthly} onChange={setMonthly} placeholder="0" unit="EGP" />
      <ResultCard rows={[
        { label: 'Total Contributions', value: totalContrib > 0 ? `${fmt(totalContrib)} EGP` : '—' },
        { label: 'Growth from Returns', value: growth > 0 ? `${fmt(growth)} EGP` : '—' },
        { label: 'Final Value', value: final > 0 ? `${fmt(final)} EGP` : '—', highlight: true },
      ]} />
    </ModalShell>
  );
}

// ─── 7. Gold Purity Converter ─────────────────────────────────────────────────

function GoldPurityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [grams, setGrams] = useState('');
  const [fromK, setFromK] = useState<'24' | '22' | '21' | '18'>('21');
  const purities: Record<string, number> = { '24': 1, '22': 22/24, '21': 21/24, '18': 18/24 };
  const pureGold = parseNum(grams) * purities[fromK];

  return (
    <ModalShell visible={visible} title="Gold Purity Converter" icon="layers" iconColor="#C9A227" onClose={onClose}>
      <SegPicker
        options={[{ key: '24', label: '24K' }, { key: '22', label: '22K' }, { key: '21', label: '21K' }, { key: '18', label: '18K' }]}
        value={fromK}
        onChange={setFromK}
      />
      <CalcInput label={`Weight in ${fromK}K gold (grams)`} value={grams} onChange={setGrams} unit="g" />
      <ResultCard rows={[
        { label: 'Equivalent in 24K (pure)', value: pureGold > 0 ? `${pureGold.toFixed(3)} g` : '—', highlight: true },
        { label: 'Equivalent in 22K', value: pureGold > 0 ? `${(pureGold / (22/24)).toFixed(3)} g` : '—' },
        { label: 'Equivalent in 21K', value: pureGold > 0 ? `${(pureGold / (21/24)).toFixed(3)} g` : '—' },
        { label: 'Equivalent in 18K', value: pureGold > 0 ? `${(pureGold / (18/24)).toFixed(3)} g` : '—' },
      ]} />
    </ModalShell>
  );
}

// ─── 8. Gram ↔ Troy Oz ───────────────────────────────────────────────────────

function WeightModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [dir, setDir] = useState<'gToOz' | 'ozToG'>('gToOz');
  const TROY_OZ = 31.1035;
  const result = dir === 'gToOz' ? parseNum(amount) / TROY_OZ : parseNum(amount) * TROY_OZ;
  const fromUnit = dir === 'gToOz' ? 'grams' : 'troy oz';
  const toUnit = dir === 'gToOz' ? 'troy oz' : 'grams';

  return (
    <ModalShell visible={visible} title="Weight Converter" icon="maximize-2" iconColor="#F59E0B" onClose={onClose}>
      <SegPicker
        options={[{ key: 'gToOz', label: 'g → Troy Oz' }, { key: 'ozToG', label: 'Troy Oz → g' }]}
        value={dir}
        onChange={setDir}
      />
      <CalcInput label={`Amount (${fromUnit})`} value={amount} onChange={setAmount} unit={dir === 'gToOz' ? 'g' : 'oz'} />
      <ResultCard rows={[
        { label: `Result (${toUnit})`, value: result > 0 ? `${result.toFixed(4)} ${toUnit}` : '—', highlight: true },
        { label: '1 Troy Oz =', value: '31.1035 grams' },
      ]} />
    </ModalShell>
  );
}

// ─── Tool grid ─────────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'zakat',    icon: 'moon',         label: 'Zakat',           sub: 'Smart Calculator', color: '#10B981' },
  { id: 'gold',     icon: 'award',        label: 'Gold Value',      sub: 'Live price',       color: '#C9A227' },
  { id: 'silver',   icon: 'circle',       label: 'Silver Value',    sub: 'Live price',       color: '#C0C8D4' },
  { id: 'currency', icon: 'refresh-cw',   label: 'Currency',        sub: 'EGP ↔ USD',       color: '#4A9EFF' },
  { id: 'roi',      icon: 'trending-up',  label: 'ROI',             sub: 'Return on invest', color: '#00D4AA' },
  { id: 'compound', icon: 'bar-chart-2',  label: 'Compound',        sub: 'Growth calc',      color: '#A47FCA' },
  { id: 'purity',   icon: 'layers',       label: 'Gold Purity',     sub: '24K → 21K → 18K', color: '#C9A227' },
  { id: 'weight',   icon: 'maximize-2',   label: 'Weight',          sub: 'g ↔ Troy Oz',     color: '#F59E0B' },
] as const;
type ToolId = typeof TOOLS[number]['id'];

function ToolCard({ tool, onPress }: { tool: typeof TOOLS[number]; onPress: () => void }) {
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
          <Feather name={tool.icon as any} size={22} color={tool.color} />
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
  const [open, setOpen] = useState<ToolId | null>(null);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={ft.wrap}
        contentContainerStyle={ft.row}
      >
        {TOOLS.map(tool => (
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
