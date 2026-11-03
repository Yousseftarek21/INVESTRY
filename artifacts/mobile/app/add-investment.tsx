import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useHaptic } from '@/hooks/useHaptic';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useAuth } from '@clerk/expo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useSubscription } from '@/context/SubscriptionContext';
import { useCash } from '@/context/CashContext';
import { FixedIncomeSubtype, GoldKarat, Holding, LinkedLoan, MetalForm, PaymentFrequency, PersonalAssetCategory, PersonalAssetCurrency, PropertyStatus, PropertyType, ValuationSource } from '@/types';
import { EGX_COMPANIES } from '@/data/egx-companies';
import { GLOBAL_COMPANIES } from '@/data/global-stocks';
import { citiesForGovernorate, districtsForCity, GOVERNORATE_NAMES } from '@/data/egypt-locations';
import { RE_PRICES, REAreaPrice, RE_COMPOUNDS, RECompound } from '@/data/egypt-real-estate-prices';
import { useRealEstateCompoundPrices } from '@/hooks/useRealEstateCompoundPrices';
import { useRealEstatePrices, RealEstateAreaLive } from '@/hooks/useRealEstatePrices';
import { parseAmount, cleanAmountInput } from '@/utils/parseAmount';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { useGlobalStocks } from '@/hooks/useGlobalStocks';
import { useMarketPrices, goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';
import { DatePickerField } from '@/components/DatePickerField';
import { AmountInput } from '@/components/AmountInput';
import { AddInvestmentPreview, type PreviewRow } from '@/components/AddInvestmentPreview';
import { StockLogo } from '@/components/StockLogo';
import { FREE_INVESTMENT_LIMIT as FREE_LIMIT } from '@/constants/subscriptionFeatures';

type InvestmentType = 'gold' | 'silver' | 'stock' | 'real_estate' | 'personal_asset' | 'fixed_income';

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

const PERSONAL_ASSET_CATEGORIES: { key: PersonalAssetCategory; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'watches', icon: 'watch' },
  { key: 'jewelry', icon: 'gift' },
  { key: 'artwork', icon: 'image' },
  { key: 'collectibles', icon: 'archive' },
  { key: 'luxury', icon: 'star' },
  { key: 'electronics', icon: 'monitor' },
  { key: 'furniture', icon: 'home' },
  { key: 'instruments', icon: 'music' },
  { key: 'other', icon: 'package' },
];

const PERSONAL_ASSET_ICONS: (keyof typeof Feather.glyphMap)[] = [
  'watch', 'gift', 'image', 'archive', 'star', 'monitor', 'home', 'music', 'package', 'briefcase',
];

// ─── EGX stock picker list ─────────────────────────────────────────────────────
// Offline fallback only — the picker prefers the live list (useEGXMarket),
// which includes new listings and leaves out stocks that aren't trading.
const EGX_SYMBOLS = EGX_COMPANIES
  .map(c => ({ symbol: c.ticker, name: c.nameEn }))
  .sort((a, b) => a.symbol.localeCompare(b.symbol));

// ─── US stock picker list ──────────────────────────────────────────────────────
// GLOBAL_COMPANIES already carries live prices via useGlobalStocks (see
// GlobalStocksMarket.tsx / the Markets tab's "US Markets" tab) — same source,
// so a holding added here is priced the same way a browsed ticker already is.
const US_SYMBOLS = GLOBAL_COMPANIES
  .map(c => ({ symbol: c.ticker, name: c.name }))
  .sort((a, b) => a.symbol.localeCompare(b.symbol));
const US_SYMBOL_SET = new Set(US_SYMBOLS.map(s => s.symbol));

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}


// ─── RE Area Lookup ───────────────────────────────────────────────────────────
// Matches a selected city/district to a curated area's IDENTITY only (its id,
// name and governorate, which are real). Prices come exclusively from the live
// scrape — the curated per-area price fields ran ~4x below real listings, and
// auto-filling them here wrote that wrong figure straight into the holding,
// where it becomes its permanent valuation (see rePrice.ts).
// District is more specific so it takes priority over city.
function lookupREArea(gov: string, cityName: string, districtName: string): REAreaPrice | null {
  const norm = (s: string) => s.toLowerCase().replace(/['''\-–—]/g, '').replace(/\s+/g, ' ').trim();
  const govNorm = norm(gov);
  const candidates = RE_PRICES.filter(p =>
    !govNorm || norm(p.governorate).includes(govNorm) || govNorm.includes(norm(p.governorate))
  );
  const match = (target: string): REAreaPrice | null => {
    if (!target) return null;
    const t = norm(target);
    // exact area match
    const exact = candidates.find(p => norm(p.area) === t);
    if (exact) return exact;
    // area contains target word or vice-versa
    return candidates.find(p => norm(p.area).includes(t) || t.includes(norm(p.area))) ?? null;
  };
  return match(districtName) ?? match(cityName);
}

// ─── Stock Picker Modal ───────────────────────────────────────────────────────

function StockPickerModal({
  visible,
  market,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** Which market this picker lists — decided by the top-level "EGX Stock" /
      "US Stock" type chip the user already tapped, not chosen inside the
      picker itself. Matches how Gold/Silver/every other type has no
      internal sub-picker of its own. */
  market: 'EGX' | 'US';
  selected: { symbol: string; name: string } | null;
  onSelect: (s: { symbol: string; name: string }) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const [query, setQuery] = useState('');

  // Live lists first (today's trading stocks, with logos); the built-in
  // lists only cover the moment before they've loaded.
  const { data: egxLive } = useEGXMarket();
  const { data: usLive } = useGlobalStocks();
  const list = useMemo<{ symbol: string; name: string; logoUrl?: string }[]>(() => {
    if (market === 'EGX') {
      return egxLive?.length
        ? egxLive.map(c => ({ symbol: c.ticker, name: c.nameEn, logoUrl: c.logoUrl })).sort((a, b) => a.symbol.localeCompare(b.symbol))
        : EGX_SYMBOLS;
    }
    return usLive?.length
      ? usLive.map(c => ({ symbol: c.ticker, name: c.name, logoUrl: c.logoUrl })).sort((a, b) => a.symbol.localeCompare(b.symbol))
      : US_SYMBOLS;
  }, [market, egxLive, usLive]);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return list;
    return list.filter(
      s => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
    );
  }, [query, list]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[pickerStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>
            {market === 'EGX' ? t.tabEGX : t.tabUsStocks}
          </Text>
          <TouchableOpacity onPress={onClose} style={[pickerStyles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[pickerStyles.searchWrap, { borderBottomColor: colors.border }]}>
          <View style={[pickerStyles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[pickerStyles.searchInput, { color: colors.text }]}
              placeholder={t.searchSymbolPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Count */}
        <Text style={[pickerStyles.countLabel, { color: colors.mutedForeground }]}>
          {filtered.length} {t.stocksListedCount}
        </Text>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.symbol}_${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item, index }) => {
            const isSelected = selected?.symbol === item.symbol;
            const isLast = index === filtered.length - 1;
            return (
              <TouchableOpacity
                style={[
                  pickerStyles.stockRow,
                  { borderBottomColor: colors.border },
                  !isLast && pickerStyles.stockRowBorder,
                  isSelected && { backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => {
                  impact();
                  onSelect(item);
                  onClose();
                }}
                activeOpacity={0.65}
              >
                <StockLogo symbol={item.symbol} logoUrl={item.logoUrl} size={40} radius={12} />
                <View style={pickerStyles.stockInfo}>
                  <Text style={[pickerStyles.symbol, { color: colors.text }]}>{item.symbol}</Text>
                  <Text style={[pickerStyles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                {isSelected && <Feather name="check-circle" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── Compound Picker Modal ──────────────────────────────────────────────────
// Lets the user pick a specific development from the curated RE_COMPOUNDS
// list (lib/shared-data) instead of only typing a free-text developer/
// compound name — selecting one links reCompoundId so the current-price
// field below can auto-fill from that compound's live scraped data (see
// useRealEstateCompoundPrices) instead of a plain area-level average.

function CompoundPickerModal({
  visible,
  selectedId,
  onSelect,
  onFreeText,
  onClose,
}: {
  visible: boolean;
  selectedId?: string;
  onSelect: (c: RECompound) => void;
  onFreeText: (query: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RE_COMPOUNDS;
    return RE_COMPOUNDS.filter(
      c => c.name.toLowerCase().includes(q) || c.developer.toLowerCase().includes(q) || c.governorate.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        <View style={[pickerStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>{t.selectCompound}</Text>
          <TouchableOpacity onPress={onClose} style={[pickerStyles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[pickerStyles.searchWrap, { borderBottomColor: colors.border }]}>
          <View style={[pickerStyles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[pickerStyles.searchInput, { color: colors.text }]}
              placeholder={t.searchCompoundPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={
            <Text style={[pickerStyles.countLabel, { color: colors.mutedForeground }]}>
              {t.compoundNotListedHint}
            </Text>
          }
          ListFooterComponent={
            query.trim().length > 0 ? (
              <TouchableOpacity
                style={[pickerStyles.stockRow, { borderBottomColor: colors.border }]}
                onPress={() => { impact(); onFreeText(query.trim()); onClose(); }}
                activeOpacity={0.65}
              >
                <View style={[pickerStyles.avatar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                </View>
                <View style={pickerStyles.stockInfo}>
                  <Text style={[pickerStyles.symbol, { color: colors.text }]}>{t.useCustomNameLabel}</Text>
                  <Text style={[pickerStyles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>"{query.trim()}"</Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isSelected = selectedId === item.id;
            const isLast = index === filtered.length - 1;
            return (
              <TouchableOpacity
                style={[
                  pickerStyles.stockRow,
                  { borderBottomColor: colors.border },
                  !isLast && pickerStyles.stockRowBorder,
                  isSelected && { backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => { impact(); onSelect(item); onClose(); }}
                activeOpacity={0.65}
              >
                <View style={[pickerStyles.avatar, {
                  backgroundColor: isSelected ? colors.primary + '25' : colors.muted,
                  borderColor: isSelected ? colors.primary + '60' : colors.border,
                }]}>
                  <MaterialCommunityIcons name="home-city" size={16} color={isSelected ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={pickerStyles.stockInfo}>
                  <Text style={[pickerStyles.symbol, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[pickerStyles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.developer} · {item.governorate}
                  </Text>
                </View>
                {isSelected && <Feather name="check-circle" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── Generic search picker modal (Governorate / City / District) ──────────────

function SearchPickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  otherLabel,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  otherLabel: string;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [query, options]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        <View style={[pickerStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[pickerStyles.closeBtn, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[pickerStyles.searchWrap, { borderBottomColor: colors.border }]}>
          <View style={[pickerStyles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[pickerStyles.searchInput, { color: colors.text }]}
              placeholder={t.searchEllipsis}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item}_${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListFooterComponent={
            query.trim().length > 0 ? (
              <TouchableOpacity
                style={[pickerStyles.stockRow, { borderBottomColor: colors.border }]}
                onPress={() => { impact(); onSelect(query.trim()); onClose(); }}
                activeOpacity={0.65}
              >
                <View style={[pickerStyles.avatar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <Feather name="edit-3" size={16} color={colors.mutedForeground} />
                </View>
                <View style={pickerStyles.stockInfo}>
                  <Text style={[pickerStyles.symbol, { color: colors.text }]}>{otherLabel}</Text>
                  <Text style={[pickerStyles.stockName, { color: colors.mutedForeground }]} numberOfLines={1}>"{query.trim()}"</Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isSelected = selected === item;
            const isLast = index === filtered.length - 1;
            return (
              <TouchableOpacity
                style={[
                  pickerStyles.stockRow,
                  { borderBottomColor: colors.border },
                  !isLast && pickerStyles.stockRowBorder,
                  isSelected && { backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => { impact(); onSelect(item); onClose(); }}
                activeOpacity={0.65}
              >
                <View style={pickerStyles.stockInfo}>
                  <Text style={[pickerStyles.symbol, { color: colors.text }]}>{item}</Text>
                </View>
                {isSelected && <Feather name="check-circle" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddInvestmentScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact, notify } = useHaptic();
  const { addHolding, updateHolding, holdings } = useHoldings();
  const { logActivity } = useActivityLog();
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();
  const { cashAccounts } = useCash();
  const { isSignedIn } = useAuth();
  const { data: egxStocks } = useEGXMarket();
  const { data: usStocks } = useGlobalStocks();
  const { data: marketPrices, isPlaceholderData: pricesArePlaceholder } = useMarketPrices();
  const { holdingId } = useLocalSearchParams<{ holdingId?: string }>();

  const editingHolding = holdingId ? holdings.find(h => h.id === holdingId) ?? null : null;
  const isEditing = editingHolding !== null;
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<InvestmentType>('gold');
  const [karat, setKarat] = useState<GoldKarat>('21k');
  const [form, setForm] = useState<MetalForm>('physical');
  const [grams, setGrams] = useState('');
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('');
  // Nothing pre-selected: a default stock used to get saved by people who
  // never opened the picker.
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null);
  const [customSymbol, setCustomSymbol] = useState('');
  const [stockPickerVisible, setStockPickerVisible] = useState(false);
  // Which market the "EGX Stock" / "US Stock" type chip the user tapped
  // committed them to — decided outside the picker now, not inside it (see
  // StockPickerModal's own comment). Both chips still save a holding with
  // type: 'stock' (every downstream valuation/leaderboard/export path
  // already keys pricing purely off `symbol`, matching both markets — see
  // hooks/useGlobalStocks.ts's egxPrices merge); this only decides which
  // symbol list the picker shows and which chip renders as active.
  const [stockMarket, setStockMarket] = useState<'EGX' | 'US'>('EGX');
  const [shares, setShares] = useState('');
  const [purchasePricePerShare, setPurchasePricePerShare] = useState('');
  // Price entry: per unit (gram/share) or the total paid. The per-unit field
  // stays the single source of truth — "total" just writes it for you.
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit');
  const [totalPaid, setTotalPaid] = useState('');
  // Gold can be entered as grams, Egyptian gold pounds (8 g of 21k) or
  // ounces (31.1 g); it's always stored as grams.
  const [goldUnit, setGoldUnit] = useState<'g' | 'pound' | 'oz'>('g');
  const [unitQty, setUnitQty] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [propertyName, setPropertyName] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [governoratePickerVisible, setGovernoratePickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
  const [area, setArea] = useState('');
  const [currentMarketPricePerM2, setCurrentMarketPricePerM2] = useState('');
  // Holds the LIVE scraped entry for the matched area (never the curated
  // estimate), and only when that scrape produced a real price.
  const [autoFilledArea, setAutoFilledArea] = useState<RealEstateAreaLive | null>(null);
  const [lastValuationDate, setLastValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuationSource, setValuationSource] = useState<ValuationSource>('manual');
  const [developer, setDeveloper] = useState('');
  const [compoundName, setCompoundName] = useState('');
  const [reCompoundId, setReCompoundId] = useState<string | undefined>(undefined);
  const [compoundPickerVisible, setCompoundPickerVisible] = useState(false);
  // null = not chosen yet (forces an explicit choice before either path's
  // fields appear) — true shows the compound picker + governorate only,
  // false shows the traditional governorate/city/district flow.
  const [isInCompound, setIsInCompound] = useState<boolean | null>(null);
  const { data: compoundPrices = [] } = useRealEstateCompoundPrices();
  const { data: areaPrices = [] } = useRealEstatePrices();
  // Live entry for a curated area id, only if it actually has a scraped price.
  const liveAreaFor = (id?: string) => {
    if (!id) return null;
    const live = areaPrices.find(a => a.id === id);
    return live && live.avgPricePerM2 != null ? live : null;
  };
  const selectedCompoundPrice = reCompoundId ? compoundPrices.find(c => c.id === reCompoundId) : undefined;
  const [unitNumber, setUnitNumber] = useState('');
  const [hasInstallmentPlan, setHasInstallmentPlan] = useState(false);
  const [installmentExpanded, setInstallmentExpanded] = useState(false);
  const [downPayment, setDownPayment] = useState('');
  const [remainingBalance, setRemainingBalance] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [installmentEndDate, setInstallmentEndDate] = useState('');
  const [hasRentalInfo, setHasRentalInfo] = useState(false);
  const [rentalExpanded, setRentalExpanded] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [annualRent, setAnnualRent] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<PropertyStatus>('owner_occupied');
  const [realEstatePurchaseDate, setRealEstatePurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [notes, setNotes] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState<PersonalAssetCategory>('watches');
  const [assetIcon, setAssetIcon] = useState<string>('watch');
  const [assetCurrency, setAssetCurrency] = useState<PersonalAssetCurrency>('EGP');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [assetIconTouched, setAssetIconTouched] = useState(false);

  const [fiSubtype, setFiSubtype] = useState<FixedIncomeSubtype>('tbill');
  const [fiLabel, setFiLabel] = useState('');
  const [fiInstitution, setFiInstitution] = useState('');
  const [fiPrincipal, setFiPrincipal] = useState('');
  const [fiAnnualRate, setFiAnnualRate] = useState('');
  const [fiPurchaseDate, setFiPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiMaturityDate, setFiMaturityDate] = useState('');
  const [fiPaymentFrequency, setFiPaymentFrequency] = useState<PaymentFrequency>('at_maturity');

  // Loan against this certificate — only meaningful when editing an
  // existing fixed_income holding (see the UI section below, gated on
  // !!editingHolding). payments[] is preserved separately, not editable
  // here — see the save logic's own comment.
  const [hasLoan, setHasLoan] = useState(false);
  const [loanExpanded, setLoanExpanded] = useState(false);
  const [loanOutstandingBalance, setLoanOutstandingBalance] = useState('');
  const [loanMonthlyInstallment, setLoanMonthlyInstallment] = useState('');
  const [loanFundingCashAccountId, setLoanFundingCashAccountId] = useState<string | undefined>(undefined);
  const [loanStartDate, setLoanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [loanNotes, setLoanNotes] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (!editingHolding) return;
    setType(editingHolding.type as InvestmentType);
    setNotes(editingHolding.notes ?? '');
    if (editingHolding.type === 'gold') {
      setKarat(editingHolding.karat);
      setForm(editingHolding.form);
      setGrams(String(editingHolding.grams ?? 0));
      setPurchasePricePerGram(String(editingHolding.purchasePricePerGram ?? 0));
      setPurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
    } else if (editingHolding.type === 'silver') {
      setForm(editingHolding.form);
      setGrams(String(editingHolding.grams ?? 0));
      setPurchasePricePerGram(String(editingHolding.purchasePricePerGram ?? 0));
      setPurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
    } else if (editingHolding.type === 'stock') {
      // Was EGX-only — editing an existing US stock holding never matched
      // anything here (only EGX_SYMBOLS was checked), so it silently fell
      // into "custom symbol" instead of being recognized as the real US
      // stock it is. Check both lists now, and set stockMarket so the
      // right "EGX Stock"/"US Stock" chip shows as active on open.
      const egxMatch = EGX_SYMBOLS.find(s => s.symbol === editingHolding.symbol);
      const usMatch = !egxMatch ? US_SYMBOLS.find(s => s.symbol === editingHolding.symbol) : undefined;
      if (egxMatch) { setSelectedStock(egxMatch); setCustomSymbol(''); setStockMarket('EGX'); }
      else if (usMatch) { setSelectedStock(usMatch); setCustomSymbol(''); setStockMarket('US'); }
      else {
        setCustomSymbol(editingHolding.symbol ?? '');
        setStockMarket(US_SYMBOL_SET.has(editingHolding.symbol ?? '') ? 'US' : 'EGX');
      }
      setShares(String(editingHolding.shares ?? 0));
      setPurchasePricePerShare(String(editingHolding.purchasePricePerShare ?? 0));
      setPurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
    } else if (editingHolding.type === 'real_estate') {
      setPropertyType(editingHolding.propertyType);
      setPropertyName(editingHolding.propertyName ?? '');
      setGovernorate(editingHolding.governorate);
      setCity(editingHolding.city);
      setDistrict(editingHolding.district);
      setArea(String(editingHolding.area ?? 0));
      // Restore auto-filled area from reAreaId if available
      if (editingHolding.currentMarketPricePerM2) {
        setCurrentMarketPricePerM2(String(editingHolding.currentMarketPricePerM2));
      }
      setLastValuationDate(editingHolding.lastValuationDate ?? new Date().toISOString().split('T')[0]);
      setValuationSource(editingHolding.valuationSource ?? 'manual');
      setPurchasePrice(String(editingHolding.purchasePrice ?? 0));
      setRealEstatePurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
      setDeveloper(editingHolding.developer ?? '');
      setCompoundName(editingHolding.compoundName ?? '');
      setReCompoundId(editingHolding.reCompoundId);
      setIsInCompound(!!editingHolding.reCompoundId || !!editingHolding.compoundName);
      setUnitNumber(editingHolding.unitNumber ?? '');
      const hasInstallment = !!editingHolding.hasInstallmentPlan;
      setHasInstallmentPlan(hasInstallment);
      setInstallmentExpanded(hasInstallment);
      setDownPayment(editingHolding.downPayment != null ? String(editingHolding.downPayment) : '');
      setRemainingBalance(editingHolding.remainingBalance != null ? String(editingHolding.remainingBalance) : '');
      setMonthlyInstallment(editingHolding.monthlyInstallment != null ? String(editingHolding.monthlyInstallment) : '');
      setInstallmentEndDate(editingHolding.installmentEndDate ?? '');
      const hasRental = editingHolding.monthlyRent != null;
      setHasRentalInfo(hasRental);
      setRentalExpanded(hasRental);
      setMonthlyRent(editingHolding.monthlyRent != null ? String(editingHolding.monthlyRent) : '');
      setAnnualRent(editingHolding.monthlyRent != null ? String(editingHolding.monthlyRent * 12) : '');
      setPropertyStatus(editingHolding.propertyStatus ?? 'owner_occupied');
    } else if (editingHolding.type === 'personal_asset') {
      setAssetName(editingHolding.name ?? '');
      setAssetCategory(editingHolding.category);
      setAssetIcon(editingHolding.icon);
      setAssetIconTouched(true);
      setPurchasePrice(String(editingHolding.purchasePrice ?? 0));
      setCurrentValue(String(editingHolding.currentValue ?? 0));
      setAssetCurrency(editingHolding.currency);
      setAssetPurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
    } else if (editingHolding.type === 'fixed_income') {
      setFiSubtype(editingHolding.subtype);
      setFiLabel(editingHolding.label ?? '');
      setFiInstitution(editingHolding.institution ?? '');
      setFiPrincipal(String(editingHolding.principal ?? 0));
      setFiAnnualRate(String(editingHolding.annualRate ?? 0));
      setFiPurchaseDate(editingHolding.purchaseDate ?? new Date().toISOString().split('T')[0]);
      setFiMaturityDate(editingHolding.maturityDate ?? '');
      setFiPaymentFrequency(editingHolding.paymentFrequency ?? 'at_maturity');
      const loan = editingHolding.linkedLoan;
      setHasLoan(!!loan);
      setLoanExpanded(!!loan);
      setLoanOutstandingBalance(loan ? String(loan.outstandingBalance) : '');
      setLoanMonthlyInstallment(loan ? String(loan.monthlyInstallment) : '');
      setLoanFundingCashAccountId(loan?.fundingCashAccountId);
      setLoanStartDate(loan?.startDate ?? new Date().toISOString().split('T')[0]);
      setLoanNotes(loan?.notes ?? '');
    }
  }, [holdingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-pick a default icon for the selected category until the user overrides it
  useEffect(() => {
    if (assetIconTouched) return;
    const match = PERSONAL_ASSET_CATEGORIES.find(c => c.key === assetCategory);
    if (match) setAssetIcon(match.icon);
  }, [assetCategory, assetIconTouched]);

  const inputStyle = [styles.input, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }];
  const labelStyle = [styles.label, { color: colors.mutedForeground }];

  const KARATS: GoldKarat[] = ['24k', '22k', '21k', '18k'];

  // 'us_stock' is a UI-only chip key, not a real InvestmentType — both it
  // and 'stock' save a holding as type: 'stock' (see the stockMarket state
  // declaration's own comment for why that's correct, not a shortcut).
  type TypeChipKey = InvestmentType | 'us_stock';
  const TYPES: { key: TypeChipKey; label: string; renderIcon: (size: number, color: string) => React.ReactNode; color: string }[] = [
    { key: 'gold',           label: t.gold,         renderIcon: (s, c) => <MaterialCommunityIcons name="gold"          size={s} color={c} />, color: colors.primary },
    { key: 'silver',         label: t.silver,        renderIcon: (s, c) => <MaterialCommunityIcons name="gold" size={s} color={c} />, color: colors.silverColor },
    { key: 'stock',          label: t.egxStock,      renderIcon: (s, c) => <Feather name="bar-chart-2"                  size={s} color={c} />, color: '#4A9EFF' },
    { key: 'us_stock',       label: t.usStockType,   renderIcon: (s, c) => <Feather name="activity"                     size={s} color={c} />, color: '#14B8A6' },
    { key: 'real_estate',    label: t.realEstate,    renderIcon: (s, c) => <MaterialCommunityIcons name="home-city"     size={s} color={c} />, color: '#A47FCA' },
    { key: 'personal_asset', label: t.personalAsset, renderIcon: (s, c) => <MaterialCommunityIcons name="tag-multiple"  size={s} color={c} />, color: '#E08E45' },
    { key: 'fixed_income',   label: t.fixedIncome,   renderIcon: (s, c) => <MaterialCommunityIcons name="bank-transfer" size={s} color={c} />, color: '#22C55E' },
  ];






  const CATEGORY_LABELS: Record<PersonalAssetCategory, string> = {
    watches: t.catWatches,
    jewelry: t.catJewelry,
    artwork: t.catArtwork,
    collectibles: t.catCollectibles,
    luxury: t.catLuxury,
    electronics: t.catElectronics,
    furniture: t.catFurniture,
    instruments: t.catInstruments,
    other: t.catOther,
  };

  const PROPERTY_TYPES: { key: PropertyType; label: string }[] = [
    { key: 'apartment', label: t.apartment },
    { key: 'villa', label: t.villa },
    { key: 'duplex', label: t.duplex },
    { key: 'penthouse', label: t.penthouse },
    { key: 'townhouse', label: t.townhouse },
    { key: 'chalet', label: t.chalet },
    { key: 'land', label: t.land },
    { key: 'office', label: t.office },
    { key: 'retail_shop', label: t.retailShop },
    { key: 'commercial', label: t.commercial },
    { key: 'medical_clinic', label: t.medicalClinic },
    { key: 'warehouse', label: t.warehouse },
  ];

  const VALUATION_SOURCES: { key: ValuationSource; label: string }[] = [
    { key: 'manual', label: t.valuationManual },
    { key: 'developer', label: t.valuationDeveloper },
    { key: 'broker', label: t.valuationBroker },
  ];

  const PROPERTY_STATUSES: { key: PropertyStatus; label: string }[] = [
    { key: 'owner_occupied', label: t.statusOwnerOccupied },
    { key: 'rented', label: t.statusRented },
    { key: 'vacant', label: t.statusVacant },
    { key: 'under_construction', label: t.statusUnderConstruction },
  ];

  const reAreaNum = parseAmount(area) || 0;
  const rePricePerM2Num = parseAmount(currentMarketPricePerM2) || (autoFilledArea?.avgPricePerM2 ?? 0);
  const rePurchasePriceNum = parseAmount(purchasePrice) || 0;
  const reCurrentValue = reAreaNum * rePricePerM2Num;
  const rePurchasePricePerM2 = reAreaNum > 0 ? rePurchasePriceNum / reAreaNum : 0;
  const reGainLoss = reCurrentValue - rePurchasePriceNum;
  const reAppreciationPct = rePurchasePriceNum > 0 ? (reGainLoss / rePurchasePriceNum) * 100 : 0;
  // ROI used to just re-display reAppreciationPct under a second label —
  // annualRent was collected in the Rental Info section but never actually
  // used anywhere, so a rented-out property's ROI looked identical to one
  // that was never rented at all. Real total return = price appreciation +
  // a year of rental income, both as a % of what was actually paid.
  const reAnnualRentNum = hasRentalInfo ? (parseAmount(annualRent) || 0) : 0;
  const reROIPct = rePurchasePriceNum > 0 ? ((reGainLoss + reAnnualRentNum) / rePurchasePriceNum) * 100 : 0;
  const reShowSummary = reAreaNum > 0 && rePricePerM2Num > 0 && rePurchasePriceNum > 0;

  // Live preview for the other types (real estate has its own summary card
  // above). Only positive, finite inputs count — a half-typed "." or empty
  // field just hides the card instead of showing NaN.
  const preview = useMemo((): { rows: PreviewRow[]; currency: string; note?: string } | null => {
    const num = (v: string) => { const n = parseAmount(v); return Number.isFinite(n) && n > 0 ? n : null; };
    const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const gainRows = (cost: number, value: number): PreviewRow[] => {
      const pct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
      return [
        { label: t.previewPaid, value: cost },
        { label: t.previewWorthToday, value },
        { label: `${t.previewGain} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`, value: value - cost, signed: true },
      ];
    };
    const livePrices = marketPrices && !pricesArePlaceholder ? marketPrices : null;

    if (type === 'gold' || type === 'silver') {
      const g = num(grams); const ppg = num(purchasePricePerGram);
      if (g == null || ppg == null) return null;
      const cost = g * ppg;
      const live = livePrices ? (type === 'gold' ? goldPricePerGram(livePrices, karat) : silverPricePerGram(livePrices)) : null;
      if (live == null || !Number.isFinite(live) || live <= 0) {
        return { rows: [{ label: t.previewPaid, value: cost }], currency: 'EGP', note: t.previewNoLive };
      }
      return { rows: gainRows(cost, g * live), currency: 'EGP', note: t.previewAtPrice(fmt(live), t.previewPerGram) };
    }
    if (type === 'stock') {
      // US prices are quoted in dollars; only EGX gets a today's-value line.
      if (stockMarket !== 'EGX') return null;
      const n = num(shares); const pps = num(purchasePricePerShare);
      if (n == null || pps == null) return null;
      const sym = customSymbol.trim().toUpperCase() || selectedStock?.symbol;
      if (!sym) return null;
      const live = egxStocks?.find(st => st.ticker === sym)?.price;
      const cost = n * pps;
      if (!live || !Number.isFinite(live) || live <= 0) {
        return { rows: [{ label: t.previewPaid, value: cost }], currency: 'EGP', note: t.previewNoLive };
      }
      return { rows: gainRows(cost, n * live), currency: 'EGP', note: t.previewAtPrice(fmt(live), t.previewPerShare) };
    }
    if (type === 'fixed_income') {
      const p = num(fiPrincipal); const rate = num(fiAnnualRate);
      if (p == null || rate == null) return null;
      const yearly = p * rate / 100;
      const rows: PreviewRow[] = [
        { label: t.previewInvested, value: p },
        { label: t.previewYearlyInterest, value: yearly, signed: true },
      ];
      const days = fiMaturityDate && fiPurchaseDate
        ? (Date.parse(fiMaturityDate) - Date.parse(fiPurchaseDate)) / 86_400_000
        : NaN;
      if (Number.isFinite(days) && days > 0) rows.push({ label: t.previewInterestToMaturity, value: yearly * days / 365, signed: true });
      return { rows, currency: 'EGP' };
    }
    if (type === 'personal_asset') {
      const cost = num(purchasePrice);
      if (cost == null) return null;
      const value = num(currentValue);
      return value == null
        ? { rows: [{ label: t.previewPaid, value: cost }], currency: assetCurrency }
        : { rows: gainRows(cost, value), currency: assetCurrency };
    }
    return null;
  }, [type, grams, purchasePricePerGram, karat, marketPrices, pricesArePlaceholder, stockMarket, shares, purchasePricePerShare,
      customSymbol, selectedStock, egxStocks, fiPrincipal, fiAnnualRate, fiPurchaseDate, fiMaturityDate, purchasePrice, currentValue, assetCurrency, t]);
  // Heuristic: a total purchase price for a property bigger than ~5 m² should be a
  // multiple of the per-m² rate, not roughly equal to it. If the number the user typed
  // as the "total" is within the same order of magnitude as the current price/m², they
  // most likely typed a per-m² figure by mistake — flag it before they save a distorted P/L.
  const rePurchasePriceLooksPerM2 =
    reAreaNum > 5 && rePurchasePriceNum > 0 && rePricePerM2Num > 0 &&
    rePurchasePriceNum < rePricePerM2Num * reAreaNum * 0.3 &&
    rePurchasePriceNum > rePricePerM2Num * 0.2 &&
    rePurchasePriceNum < rePricePerM2Num * 5;

  const typeCardAnims = useRef<Record<'gold' | 'silver' | 'stock' | 'us_stock' | 'real_estate' | 'personal_asset' | 'fixed_income', Animated.Value>>({
    gold: new Animated.Value(1),
    silver: new Animated.Value(1),
    stock: new Animated.Value(1),
    us_stock: new Animated.Value(1),
    real_estate: new Animated.Value(1),
    personal_asset: new Animated.Value(1),
    fixed_income: new Animated.Value(1),
  }).current;

  // 'stock' and 'us_stock' both commit to type: 'stock' — only stockMarket
  // (and which symbol list/chip is shown) differs. Switching market resets
  // the selected symbol to that market's first entry rather than leaving a
  // stale EGX pick showing while the US list is active, or vice versa.
  const selectType = (key: TypeChipKey) => {
    if (isEditing) return;
    // A typed total belongs to the previous type's quantity — start clean.
    setPriceMode('unit');
    setTotalPaid('');
    Animated.sequence([
      Animated.timing(typeCardAnims[key], { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(typeCardAnims[key], { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    if (key === 'us_stock') {
      setType('stock');
      setStockMarket('US');
      setSelectedStock(null);
      setCustomSymbol('');
    } else if (key === 'stock') {
      setType('stock');
      setStockMarket('EGX');
      setSelectedStock(null);
      setCustomSymbol('');
    } else {
      setType(key);
    }
  };

  const Chip = ({ value, selected, onPress, label }: { value: string; selected: boolean; onPress: () => void; label?: string }) => (
    <TouchableOpacity
      style={[styles.chip, {
        backgroundColor: selected ? colors.primary : colors.cardSecondary,
        borderColor: selected ? colors.primary : colors.border,
      }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.text }]}>
        {label ?? value}
      </Text>
    </TouchableOpacity>
  );

  const promptSignInToSave = () => {
    Alert.alert(t.subSignInToUnlock, t.subSignInToUnlockDesc, [
      { text: t.subCancel, style: 'cancel' },
      { text: t.subSignInButton, onPress: () => router.push('/(auth)/welcome' as any) },
    ]);
  };

  const saveInFlight = useRef(false);
  // Guards the whole save, including the price-check alert it may await —
  // `saving` state alone only kicks in after that alert, so a quick double
  // tap could open two alerts and add the same lot twice.
  const handleSave = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      await saveHolding();
    } finally {
      saveInFlight.current = false;
    }
  };

  const saveHolding = async () => {
    // Without a signed-in account there is nowhere to persist this holding —
    // catch it here before any validation so we never silently drop it.
    if (!isSignedIn) {
      promptSignInToSave();
      return;
    }

    // Free tier: max 1 investment. Skip the gate while subscription is still
    // loading (subLoading=true), or when Pro is active.
    if (!isEditing && !subLoading && !featuresUnlocked && holdings.length >= FREE_LIMIT) {
      showPaywallFromModal();
      return;
    }

    let holding: Holding | null = null;
    const id = editingHolding?.id ?? generateId();

    if (type === 'gold') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id, type: 'gold', karat, form, grams: parseAmount(grams), purchasePricePerGram: parseAmount(purchasePricePerGram), purchaseDate, notes };
    } else if (type === 'silver') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id, type: 'silver', form, grams: parseAmount(grams), purchasePricePerGram: parseAmount(purchasePricePerGram), purchaseDate, notes };
    } else if (type === 'stock') {
      const sym = customSymbol.trim().toUpperCase() || selectedStock?.symbol;
      if (!sym) { Alert.alert(t.missingFields, t.chooseStockFirst); return; }
      if (!shares || !purchasePricePerShare) { Alert.alert(t.missingFields, t.enterSharesAndPrice); return; }
      const name = customSymbol.trim() ? customSymbol.trim().toUpperCase() : (selectedStock?.name ?? sym);
      holding = { id, type: 'stock', symbol: sym, companyName: name, shares: parseAmount(shares), purchasePricePerShare: parseAmount(purchasePricePerShare), purchaseDate, notes };
    } else if (type === 'real_estate') {
      const finalGovernorate = governorate.trim();
      // City/District only apply to the standalone-property path — a
      // compound already IS the specific location, so district holds the
      // compound name instead (still a meaningful, non-empty value for a
      // field the data type requires as a plain string).
      const finalCity = isInCompound ? '' : city.trim();
      const finalDistrict = isInCompound ? compoundName.trim() : district.trim();
      if (
        isInCompound === null ||
        !propertyName.trim() || !finalGovernorate ||
        (!isInCompound && (!finalCity || !finalDistrict)) ||
        (isInCompound && !finalDistrict) ||
        !area || !purchasePrice || !realEstatePurchaseDate || rePricePerM2Num === 0
      ) {
        Alert.alert(t.missingFields, t.enterRealEstateRequired);
        return;
      }
      const parsedArea = parseAmount(area);
      const computedCurrentValue = parsedArea * rePricePerM2Num;
      holding = {
        id, type: 'real_estate',
        propertyName: propertyName.trim(),
        propertyType,
        governorate: finalGovernorate,
        city: finalCity,
        district: finalDistrict,
        area: parsedArea,
        reAreaId: autoFilledArea?.id,
        currentMarketPricePerM2: rePricePerM2Num,
        currentValue: computedCurrentValue,
        lastValuationDate: lastValuationDate || undefined,
        valuationSource,
        purchasePrice: parseAmount(purchasePrice),
        purchaseDate: realEstatePurchaseDate,
        developer: developer.trim() || undefined,
        compoundName: compoundName.trim() || undefined,
        reCompoundId,
        unitNumber: unitNumber.trim() || undefined,
        hasInstallmentPlan: hasInstallmentPlan || undefined,
        downPayment: hasInstallmentPlan && downPayment ? parseAmount(downPayment) : undefined,
        remainingBalance: hasInstallmentPlan && remainingBalance ? parseAmount(remainingBalance) : undefined,
        monthlyInstallment: hasInstallmentPlan && monthlyInstallment ? parseAmount(monthlyInstallment) : undefined,
        installmentEndDate: hasInstallmentPlan && installmentEndDate ? installmentEndDate : undefined,
        monthlyRent: hasRentalInfo && monthlyRent ? parseAmount(monthlyRent) : undefined,
        propertyStatus: hasRentalInfo ? propertyStatus : undefined,
        notes,
      };
    } else if (type === 'personal_asset') {
      if (!assetName.trim() || !purchasePrice) { Alert.alert(t.missingFields, t.enterAssetDetails); return; }
      const parsedPurchasePrice = parseAmount(purchasePrice);
      const parsedCurrentValue = currentValue ? parseAmount(currentValue) : parsedPurchasePrice;
      holding = {
        id, type: 'personal_asset',
        name: assetName.trim(), category: assetCategory, icon: assetIcon,
        purchasePrice: parsedPurchasePrice, currentValue: parsedCurrentValue,
        currency: assetCurrency, purchaseDate: assetPurchaseDate || today, notes,
      };
    } else if (type === 'fixed_income') {
      if (!fiLabel.trim() || !fiInstitution.trim() || !fiPrincipal || !fiAnnualRate || !fiPurchaseDate || !fiMaturityDate) {
        Alert.alert(t.missingFields, t.enterFixedIncomeDetails);
        return;
      }
      // payments[] is a confirmed history, never edited from this form —
      // carry it over unchanged from the holding being edited (empty for a
      // brand-new loan). Only "Mark This Month Paid" (HoldingCard) appends
      // to it.
      const existingPayments = editingHolding?.type === 'fixed_income' ? editingHolding.linkedLoan?.payments ?? [] : [];
      const linkedLoan: LinkedLoan | undefined = hasLoan && loanOutstandingBalance && loanMonthlyInstallment
        ? {
            outstandingBalance: parseAmount(loanOutstandingBalance),
            monthlyInstallment: parseAmount(loanMonthlyInstallment),
            fundingCashAccountId: loanFundingCashAccountId,
            startDate: loanStartDate || today,
            notes: loanNotes.trim() || undefined,
            payments: existingPayments,
          }
        : undefined;
      holding = {
        id, type: 'fixed_income',
        subtype: fiSubtype,
        label: fiLabel.trim(),
        institution: fiInstitution.trim(),
        principal: parseAmount(fiPrincipal),
        annualRate: parseAmount(fiAnnualRate),
        purchaseDate: fiPurchaseDate,
        maturityDate: fiMaturityDate,
        paymentFrequency: fiPaymentFrequency,
        notes,
        linkedLoan,
      };
    }

    if (!holding) return;

    // The empty-field checks above let "." and "0" through — "." parses to
    // NaN, which saves as null and later crashes HoldingCard's toLocaleString.
    const positive = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) && n > 0;
    const nonNegative = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const optional = (n: number | undefined) => n === undefined || nonNegative(n);
    const amountsValid = ((h: Holding) => {
      switch (h.type) {
        case 'gold':
        case 'silver': return positive(h.grams) && nonNegative(h.purchasePricePerGram);
        case 'stock': return positive(h.shares) && nonNegative(h.purchasePricePerShare);
        case 'real_estate': return positive(h.area) && nonNegative(h.purchasePrice)
          && optional(h.downPayment) && optional(h.remainingBalance) && optional(h.monthlyInstallment) && optional(h.monthlyRent);
        case 'personal_asset': return nonNegative(h.purchasePrice) && nonNegative(h.currentValue);
        case 'fixed_income': return positive(h.principal) && nonNegative(h.annualRate)
          && (!h.linkedLoan || (nonNegative(h.linkedLoan.outstandingBalance) && nonNegative(h.linkedLoan.monthlyInstallment)));
        default: return true;
      }
    })(holding);
    if (!amountsValid) {
      Alert.alert(t.invalidAmountTitle, t.invalidAmountDesc);
      return;
    }

    // Soft typo check against today's market price (warn, never block — a
    // purchase from years ago can legitimately be far below today's price).
    // Only where a real live price exists: EGX stocks, and gold/silver once
    // real (non-placeholder) prices have loaded.
    const paidPerUnit = holding.type === 'stock' ? holding.purchasePricePerShare
      : holding.type === 'gold' || holding.type === 'silver' ? holding.purchasePricePerGram
      : null;
    let marketPerUnit: number | null = null;
    if (holding.type === 'stock') {
      const sym = holding.symbol;
      const live = egxStocks?.find(s => s.ticker === sym);
      marketPerUnit = live && live.price > 0 ? live.price : null;
    } else if (!pricesArePlaceholder && marketPrices) {
      if (holding.type === 'gold') marketPerUnit = goldPricePerGram(marketPrices, holding.karat);
      else if (holding.type === 'silver') marketPerUnit = silverPricePerGram(marketPrices);
    }
    const priceChanged = !isEditing || editingHolding == null
      || (editingHolding.type === 'stock' && holding.type === 'stock' && editingHolding.purchasePricePerShare !== holding.purchasePricePerShare)
      || ((editingHolding.type === 'gold' || editingHolding.type === 'silver') && (holding.type === 'gold' || holding.type === 'silver')
        && editingHolding.purchasePricePerGram !== holding.purchasePricePerGram);
    if (priceChanged && paidPerUnit != null && marketPerUnit != null && Number.isFinite(marketPerUnit) && marketPerUnit > 0
      && (paidPerUnit < marketPerUnit * 0.05 || paidPerUnit > marketPerUnit * 3)) {
      const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert(t.priceCheckTitle, t.priceCheckDesc(fmt(paidPerUnit), fmt(marketPerUnit!)), [
          { text: t.priceCheckEdit, style: 'cancel', onPress: () => resolve(false) },
          { text: t.priceCheckSaveAnyway, onPress: () => resolve(true) },
        ], { cancelable: true, onDismiss: () => resolve(false) });
      });
      if (!proceed) return;
    }

    notify();
    // Short "what this is" line for the activity-log confirmation — no
    // field-by-field diffing between old/new on edit (six holding shapes
    // would each need their own diff logic); just describes the holding as
    // it stands after the save, same for add and edit.
    const describeHolding = (h: Holding): string => {
      switch (h.type) {
        case 'gold': return `${t.gold}: ${h.grams}g`;
        case 'silver': return `${t.silver}: ${h.grams}g`;
        case 'stock': return `${h.symbol}: ${h.shares} ${t.sharesLabel}`;
        case 'real_estate': return h.propertyName;
        case 'personal_asset': return h.name;
        case 'fixed_income': return h.label;
        default: return t.egxStocksAllocLabel;
      }
    };
    // addHolding/updateHolding update local state synchronously (so the list
    // already reflects the edit) but still await the network round-trip here
    // before navigating away — otherwise a failed save gets silently rolled
    // back a moment later, after the user has already left the screen and
    // has no idea their edit didn't actually stick.
    try {
      setSaving(true);
      if (isEditing) {
        await updateHolding(holding);
        logActivity('holding_edited', t.activityHoldingEditedTitle, describeHolding(holding), holding.id);
        router.back();
      } else {
        // Every addition is now its own lot, even for an asset already held
        // (same karat, same ticker) — merging into one blended-average row
        // used to be deliberate, but it destroyed the one thing per-lot
        // tracking needs: knowing that THIS 10g was added today while the
        // OTHER 100g has been held since last week, each with its own real,
        // server-stamped price. The Holdings list still groups same-asset
        // lots into one card (see groupLots in utils/lotGrouping.ts) —
        // this only changes how they're stored, not how they look.
        await addHolding(holding);
        logActivity('holding_added', t.activityHoldingAddedTitle, describeHolding(holding), holding.id);
        // Editing came from the holdings list, so `back()` already returns there.
        // Adding came through the add-choose type picker, so `back()` alone would
        // just land back on that picker sheet — dismiss past it to the list instead.
        router.dismissTo('/(tabs)/holdings');
      }
    } catch {
      Alert.alert(t.couldNotSave, t.couldNotOpenLinkDesc);
    } finally {
      setSaving(false);
    }
  };

  const GOLD_UNIT_GRAMS = { g: 1, pound: 8, oz: 31.1035 } as const;
  const numStr = (n: number) => String(Math.round(n * 10000) / 10000);
  const posNum = (v: string) => { const n = parseAmount(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const isStock = type === 'stock';
  const qtyValue = isStock ? shares : grams;
  const setQty = isStock ? setShares : setGrams;
  const unitPrice = isStock ? purchasePricePerShare : purchasePricePerGram;
  const setUnitPrice = isStock ? setPurchasePricePerShare : setPurchasePricePerGram;
  const unitWord = isStock ? t.previewPerShare : t.previewPerGram;

  // Quantity in base units (grams or shares) changed: keep a typed total in sync.
  const applyQty = (base: string) => {
    setQty(base);
    if (priceMode === 'total') {
      const q = posNum(base); const tot = posNum(totalPaid);
      setUnitPrice(q != null && tot != null ? numStr(tot / q) : '');
    }
  };
  const onUnitQtyChange = (v: string) => {
    setUnitQty(v);
    const n = posNum(v);
    applyQty(n != null ? numStr(n * GOLD_UNIT_GRAMS[goldUnit]) : '');
  };
  const selectGoldUnit = (u: 'g' | 'pound' | 'oz') => {
    setGoldUnit(u);
    if (u === 'pound') setKarat('21k');
    if (u === 'oz') setKarat('24k');
    const g = posNum(grams);
    setUnitQty(g != null && u !== 'g' ? numStr(g / GOLD_UNIT_GRAMS[u]) : '');
  };
  const onTotalChange = (v: string) => {
    setTotalPaid(v);
    const q = posNum(qtyValue); const tot = posNum(v);
    setUnitPrice(q != null && tot != null ? numStr(tot / q) : '');
  };
  const selectPriceMode = (m: 'unit' | 'total') => {
    if (m === 'total') {
      const q = posNum(qtyValue); const u = posNum(unitPrice);
      setTotalPaid(q != null && u != null ? numStr(q * u) : '');
    }
    setPriceMode(m);
  };

  // Today's price per gram/share, where a real one exists.
  const todayUnitPrice = (() => {
    if (type === 'gold' || type === 'silver') {
      if (!marketPrices || pricesArePlaceholder) return null;
      const v = type === 'gold' ? goldPricePerGram(marketPrices, karat) : silverPricePerGram(marketPrices);
      return Number.isFinite(v) && v > 0 ? v : null;
    }
    if (type === 'stock' && stockMarket === 'EGX') {
      const sym = customSymbol.trim().toUpperCase() || selectedStock?.symbol;
      const v = sym ? egxStocks?.find(st => st.ticker === sym)?.price : undefined;
      return v && Number.isFinite(v) && v > 0 ? v : null;
    }
    return null;
  })();
  const useTodayPrice = () => {
    if (todayUnitPrice == null) return;
    impact();
    setUnitPrice(numStr(Math.round(todayUnitPrice * 100) / 100));
    setPriceMode('unit');
  };
  const fmt2 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

  // Quantity + price fields shared by gold, silver and stocks. Plain render
  // functions (not components) so inputs keep focus between keystrokes.
  const renderQuantity = () => {
    if (isStock) {
      return (
        <View style={styles.section}>
          <Text style={labelStyle}>{t.numberOfShares}</Text>
          <AmountInput style={inputStyle} placeholder={t.exampleValue('100')} placeholderTextColor={colors.mutedForeground}
            value={shares} onChangeText={applyQty} />
        </View>
      );
    }
    const byUnit = type === 'gold' && goldUnit !== 'g';
    return (
      <View style={styles.section}>
        {type === 'gold' && (
          <View style={[styles.chips, { marginBottom: 12 }]}>
            {(['g', 'pound', 'oz'] as const).map(u => (
              <Chip key={u} value={u} selected={goldUnit === u} onPress={() => selectGoldUnit(u)}
                label={u === 'g' ? t.goldUnitGrams : u === 'pound' ? t.goldUnitPound : t.goldUnitOunce} />
            ))}
          </View>
        )}
        <Text style={labelStyle}>{byUnit ? (goldUnit === 'pound' ? t.qtyGoldPounds : t.qtyOunces) : t.weightGrams}</Text>
        {byUnit ? (
          <>
            <AmountInput style={inputStyle} placeholder={t.exampleValue('2')} placeholderTextColor={colors.mutedForeground}
              value={unitQty} onChangeText={onUnitQtyChange} />
            {posNum(grams) != null && (
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{t.equalsGrams(fmt2(parseAmount(grams)))}</Text>
            )}
          </>
        ) : (
          <AmountInput style={inputStyle} placeholder={t.exampleValue(type === 'gold' ? '50' : '500')} placeholderTextColor={colors.mutedForeground}
            value={grams} onChangeText={applyQty} />
        )}
      </View>
    );
  };

  const renderPrice = () => (
    <View style={styles.section}>
      <View style={[styles.chips, { marginBottom: 12 }]}>
        <Chip value="unit" selected={priceMode === 'unit'} onPress={() => selectPriceMode('unit')}
          label={isStock ? t.priceModeUnitShare : t.priceModeUnitGram} />
        <Chip value="total" selected={priceMode === 'total'} onPress={() => selectPriceMode('total')} label={t.priceModeTotal} />
      </View>
      {priceMode === 'unit' ? (
        <>
          <Text style={labelStyle}>{isStock ? t.purchasePricePerShare : t.purchasePricePerGram}</Text>
          <AmountInput style={inputStyle}
            placeholder={t.exampleValue(isStock ? '95.50' : type === 'gold' ? '3900' : '52')}
            placeholderTextColor={colors.mutedForeground}
            value={unitPrice} onChangeText={setUnitPrice} />
        </>
      ) : (
        <>
          <Text style={labelStyle}>{t.totalPaidLabel}</Text>
          <AmountInput style={inputStyle} placeholder={t.exampleValue('195000')} placeholderTextColor={colors.mutedForeground}
            value={totalPaid} onChangeText={onTotalChange} />
          {posNum(unitPrice) != null && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{t.perUnitHint(fmt2(parseAmount(unitPrice)), unitWord)}</Text>
          )}
        </>
      )}
      {todayUnitPrice != null && (
        <TouchableOpacity onPress={useTodayPrice} activeOpacity={0.75}
          style={[styles.todayPriceBtn, { backgroundColor: colors.primary + '14', borderColor: colors.primary + '40' }]}>
          <Feather name="zap" size={13} color={colors.primary} />
          <Text style={[styles.todayPriceText, { color: colors.primary }]} numberOfLines={1}>
            {t.useTodayPrice(fmt2(todayUnitPrice), unitWord)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const activeStock = customSymbol.trim()
    ? { symbol: customSymbol.trim().toUpperCase(), name: 'Custom symbol' }
    : selectedStock;

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalHeader, {
          paddingTop: topInsets + 10,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Feather
              name={isEditing ? 'x' : backChevron()}
              size={22}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {isEditing ? t.editInvestment : t.addInvestment}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={8}>
            <Text style={[styles.saveBtnText, { color: colors.primary, opacity: saving ? 0.4 : 1 }]}>{t.save}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: botInsets + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {(<>
          {/* Type */}
          <View style={styles.section}>
            <Text style={labelStyle}>{t.investmentType}</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(tp => {
                const isActive = tp.key === 'stock' ? (type === 'stock' && stockMarket === 'EGX')
                  : tp.key === 'us_stock' ? (type === 'stock' && stockMarket === 'US')
                  : type === tp.key;
                const isDisabled = isEditing && !isActive;
                return (
                  <Animated.View
                    key={tp.key}
                    style={{ transform: [{ scale: typeCardAnims[tp.key] }], opacity: isDisabled ? 0.35 : 1 }}
                  >
                    <TouchableOpacity
                      style={[styles.typeChip, {
                        backgroundColor: isActive ? tp.color : colors.card,
                        borderColor: isActive ? tp.color : colors.border,
                      }]}
                      onPress={() => selectType(tp.key)}
                      activeOpacity={isEditing ? 1 : 0.85}
                    >
                      {tp.renderIcon(15, isActive ? colors.primaryForeground : tp.color)}
                      <Text style={[styles.typeChipLabel, { color: isActive ? colors.primaryForeground : colors.text }]}>{tp.label}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Gold */}
          {type === 'gold' && (<>
          <FormSection icon="star" title={t.formSecDetails}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.karat}</Text>
              <View style={styles.chips}>
                {KARATS.map(k => (
                  <Chip key={k} value={k} selected={karat === k} onPress={() => setKarat(k)} />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.form}</Text>
              <View style={styles.chips}>
                {(['physical', 'digital'] as MetalForm[]).map(f => (
                  <Chip key={f} value={f} selected={form === f} onPress={() => setForm(f)}
                    label={f === 'physical' ? t.physical : t.digital} />
                ))}
              </View>
            </View>
          </FormSection>
          <FormSection icon="shopping-bag" title={t.formSecPurchase}>
            {renderQuantity()}
            {renderPrice()}
            <View style={styles.section}>
              <DatePickerField label={t.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} />
            </View>
          </FormSection>
          </>)}

          {/* Silver */}
          {type === 'silver' && (<>
          <FormSection icon="star" title={t.formSecDetails}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.form}</Text>
              <View style={styles.chips}>
                {(['physical', 'digital'] as MetalForm[]).map(f => (
                  <Chip key={f} value={f} selected={form === f} onPress={() => setForm(f)}
                    label={f === 'physical' ? t.physical : t.digital} />
                ))}
              </View>
            </View>
          </FormSection>
          <FormSection icon="shopping-bag" title={t.formSecPurchase}>
            {renderQuantity()}
            {renderPrice()}
            <View style={styles.section}>
              <DatePickerField label={t.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} />
            </View>
          </FormSection>
          </>)}

          {/* Stock */}
          {type === 'stock' && (<>
          <FormSection icon="trending-up" title={t.formSecStock}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.stockSymbol}</Text>

              {/* Dropdown trigger */}
              <TouchableOpacity
                style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => { impact(); setStockPickerVisible(true); }}
                activeOpacity={0.75}
              >
                {activeStock ? (
                  <StockLogo
                    symbol={activeStock.symbol}
                    logoUrl={(stockMarket === 'EGX' ? egxStocks?.find(x => x.ticker === activeStock.symbol) : usStocks?.find(x => x.ticker === activeStock.symbol))?.logoUrl}
                    size={40}
                    radius={12}
                  />
                ) : (
                  <View style={[styles.dropdownAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <Feather name="search" size={16} color={colors.primary} />
                  </View>
                )}
                <View style={styles.dropdownInfo}>
                  <Text style={[styles.dropdownSymbol, { color: activeStock ? colors.text : colors.mutedForeground }]}>
                    {activeStock ? activeStock.symbol : t.chooseStock}
                  </Text>
                  {!!activeStock && (
                    <Text style={[styles.dropdownName, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {activeStock.name}
                    </Text>
                  )}
                </View>
                <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* Custom symbol override */}
              <View style={styles.customRow}>
                <View style={[styles.customDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.customOr, { color: colors.mutedForeground }]}>{t.orEnterCustom}</Text>
                <View style={[styles.customDivider, { backgroundColor: colors.border }]} />
              </View>
              <TextInput
                style={inputStyle}
                placeholder={t.customSymbol}
                placeholderTextColor={colors.mutedForeground}
                value={customSymbol}
                onChangeText={setCustomSymbol}
                autoCapitalize="characters"
              />
            </View>
          </FormSection>
          <FormSection icon="shopping-bag" title={t.formSecPurchase}>
            {renderQuantity()}
            {renderPrice()}
            <View style={styles.section}>
              <DatePickerField label={t.purchaseDate} value={purchaseDate} onChange={setPurchaseDate} />
            </View>
          </FormSection>
          </>)}

          {/* Real Estate */}
          {type === 'real_estate' && (<>
          <FormSection icon="home" title={t.formSecProperty}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.propertyName}</Text>
              <TextInput style={inputStyle} placeholder={t.propertyNamePlaceholder} placeholderTextColor={colors.mutedForeground}
                value={propertyName} onChangeText={setPropertyName} />
            </View>

            <View style={styles.section}>
              <Text style={labelStyle}>{t.propertyType}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {PROPERTY_TYPES.map(p => (
                  <Chip key={p.key} value={p.key} selected={propertyType === p.key} onPress={() => setPropertyType(p.key)}
                    label={p.label} />
                ))}
              </ScrollView>
            </View>

          </FormSection>
          <FormSection icon="map-pin" title={t.formSecLocation}>
            {/* First, explicit choice: this decides which fields show next.
                No more asking a standalone-property owner to pick a
                compound they don't have, and no more asking a compound
                owner to redundantly re-pick City/District their compound
                already implies. */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.isInCompoundLabel}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip value="no" selected={isInCompound === false} onPress={() => {
                  setIsInCompound(false);
                  setCompoundName(''); setReCompoundId(undefined);
                }} label={t.noStandalone} />
                <Chip value="yes" selected={isInCompound === true} onPress={() => {
                  setIsInCompound(true);
                  setCity(''); setDistrict('');
                }} label={t.yesInCompound} />
              </View>
            </View>

            {isInCompound === true && (
              <View style={styles.section}>
                <Text style={labelStyle}>{t.compoundName}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border, flex: 1 }]}
                    onPress={() => setCompoundPickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownSymbol, { color: compoundName ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                      {compoundName || t.selectCompound}
                    </Text>
                    <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {!!compoundName && (
                    <TouchableOpacity
                      onPress={() => { setCompoundName(''); setReCompoundId(undefined); }}
                      style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border, flex: 0, paddingHorizontal: 12 }]}
                      activeOpacity={0.7}
                      accessibilityLabel={t.clearCompoundSelection}
                    >
                      <Feather name="x" size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
                </View>
                {reCompoundId && selectedCompoundPrice && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Feather name="bar-chart-2" size={9} color={colors.green} />
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.green, letterSpacing: 0.5 }}>
                        {selectedCompoundPrice.isLive ? 'LIVE DATA' : t.reAreaEstimateBadge}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flex: 1 }} numberOfLines={1}>
                      {selectedCompoundPrice.isLive
                        ? t.compoundLiveDataHint
                        : t.compoundAreaEstimateHint(selectedCompoundPrice.areaLabel ?? selectedCompoundPrice.governorate)}
                    </Text>
                  </View>
                )}
                {/* Governorate — auto-filled by a curated pick; still shown
                    (and editable) since a free-text compound name can't
                    tell us where it is. */}
                <View style={{ marginTop: 12 }}>
                  <Text style={labelStyle}>{t.governorate}</Text>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                    onPress={() => setGovernoratePickerVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownSymbol, { color: governorate ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                      {governorate || t.selectGovernorate}
                    </Text>
                    <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {isInCompound === false && (<>
              <View style={styles.section}>
                <Text style={labelStyle}>{t.governorate}</Text>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  onPress={() => setGovernoratePickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownSymbol, { color: governorate ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                    {governorate || t.selectGovernorate}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.section}>
                <Text style={labelStyle}>{t.city}</Text>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  onPress={() => setCityPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownSymbol, { color: city ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                    {city || t.selectCity}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.section}>
                <Text style={labelStyle}>{t.district}</Text>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  onPress={() => setDistrictPickerVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownSymbol, { color: district ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                    {district || t.selectDistrict}
                  </Text>
                  <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </>)}

          </FormSection>
          <FormSection icon="maximize" title={t.formSecSizePrice}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.area}</Text>
              <AmountInput style={inputStyle} placeholder={t.areaPlaceholder} placeholderTextColor={colors.mutedForeground}
                value={area} onChangeText={setArea} />
            </View>

            <View style={styles.section}>
              <Text style={labelStyle}>{t.realEstatePurchasePrice}</Text>
              <AmountInput style={inputStyle} placeholder={t.exampleValue('3500000')} placeholderTextColor={colors.mutedForeground}
                value={purchasePrice} onChangeText={setPurchasePrice} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                {t.realEstatePurchasePriceHint}
                {reAreaNum > 0 && rePurchasePriceNum > 0
                  ? `  (≈ ${rePurchasePricePerM2.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP/m²)`
                  : ''}
              </Text>
              {rePurchasePriceLooksPerM2 && (
                <View style={[styles.warningBanner, { backgroundColor: colors.red + '1A', borderColor: colors.red }]}>
                  <Feather name="alert-triangle" size={16} color={colors.red} />
                  <Text style={[styles.warningText, { color: colors.red }]}>{t.purchasePriceSuspiciousWarning}</Text>
                </View>
              )}
            </View>
            <View style={styles.section}>
              <DatePickerField label={t.purchaseDate} value={realEstatePurchaseDate} onChange={setRealEstatePurchaseDate} />
            </View>

          </FormSection>
          <FormSection icon="bar-chart-2" title={t.formSecMarketValue}>
            {/* Current Market Price — editable, pre-filled from live data when available.
                Prefers the selected compound's own price (live scrape, or its area's
                honest fallback) over the plain area-level lookup below. */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.currentMarketPricePerM2}</Text>
              {selectedCompoundPrice?.avgPricePerM2 != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Feather name="bar-chart-2" size={9} color={colors.green} />
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.green, letterSpacing: 0.5 }}>
                      {selectedCompoundPrice.isLive ? 'LIVE DATA' : t.reAreaEstimateBadge}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flex: 1 }}>
                    {selectedCompoundPrice.minPricePerM2!.toLocaleString('en-EG')}–{selectedCompoundPrice.maxPricePerM2!.toLocaleString('en-EG')} EGP/m²
                    {!selectedCompoundPrice.isLive && selectedCompoundPrice.areaLabel ? ` (${selectedCompoundPrice.areaLabel})` : ''}
                  </Text>
                </View>
              ) : autoFilledArea && (
                /* Live data reference — shown above the editable input */
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingHorizontal: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Feather name="bar-chart-2" size={9} color={colors.green} />
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.green, letterSpacing: 0.5 }}>LIVE DATA</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flex: 1 }}>
                    {autoFilledArea.minPricePerM2!.toLocaleString('en-EG')}–{autoFilledArea.maxPricePerM2!.toLocaleString('en-EG')} EGP/m²
                    {autoFilledArea.changePercent != null ? ` · ${autoFilledArea.changePercent > 0 ? '+' : ''}${autoFilledArea.changePercent.toFixed(1)}%` : ''}
                  </Text>
                </View>
              )}
              <AmountInput
                style={inputStyle}
                placeholder={selectedCompoundPrice?.avgPricePerM2 != null
                  ? `Market avg: ${selectedCompoundPrice.avgPricePerM2.toLocaleString('en-EG')} EGP/m²`
                  : autoFilledArea?.avgPricePerM2 != null
                  ? `Market avg: ${autoFilledArea.avgPricePerM2.toLocaleString('en-EG')} EGP/m²`
                  : t.currentMarketPricePerM2Placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={currentMarketPricePerM2}
                onChangeText={setCurrentMarketPricePerM2}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.section}>
              <DatePickerField label={t.lastValuationDate} value={lastValuationDate} onChange={setLastValuationDate} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.valuationSource}</Text>
              <View style={styles.chips}>
                {VALUATION_SOURCES.map(v => (
                  <Chip key={v.key} value={v.key} selected={valuationSource === v.key} onPress={() => setValuationSource(v.key)}
                    label={v.label} />
                ))}
              </View>
            </View>

          </FormSection>
          <FormSection icon="list" title={t.formSecMore}>
            {/* Purchase info */}
            {/* Skipped when a curated compound was picked — its developer is
                already shown and auto-filled right in the compound section
                above, so a second editable "Developer" field here would
                just be the exact same value shown and editable twice. Still
                shown for standalone properties and for a compound entered
                as a custom name (developer genuinely unknown in that case,
                still needs asking). */}
            {!reCompoundId && (
              <View style={styles.section}>
                <Text style={labelStyle}>{t.developer}</Text>
                <TextInput style={inputStyle} placeholder={t.developerPlaceholder} placeholderTextColor={colors.mutedForeground}
                  value={developer} onChangeText={setDeveloper} />
              </View>
            )}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.unitNumber}</Text>
              <TextInput style={inputStyle} placeholder={t.unitNumberPlaceholder} placeholderTextColor={colors.mutedForeground}
                value={unitNumber} onChangeText={setUnitNumber} />
            </View>

            {/* Installment plan (collapsible) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.collapsibleHeader, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => {
                  const next = !hasInstallmentPlan;
                  setHasInstallmentPlan(next);
                  setInstallmentExpanded(next);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.collapsibleTitle, { color: colors.text }]}>{t.installmentPlan}</Text>
                  <Text style={[styles.collapsibleDesc, { color: colors.mutedForeground }]}>{t.installmentPlanDesc}</Text>
                </View>
                <Feather name={hasInstallmentPlan ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {hasInstallmentPlan && installmentExpanded && (
                <View style={styles.collapsibleBody}>
                  <Text style={labelStyle}>{t.downPayment}</Text>
                  <AmountInput style={inputStyle} placeholder={t.exampleValue('500000')} placeholderTextColor={colors.mutedForeground}
                    value={downPayment} onChangeText={setDownPayment} />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.remainingBalance}</Text>
                  <AmountInput style={inputStyle} placeholder={t.exampleValue('2000000')} placeholderTextColor={colors.mutedForeground}
                    value={remainingBalance} onChangeText={setRemainingBalance} />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.monthlyInstallment}</Text>
                  <AmountInput style={inputStyle} placeholder={t.exampleValue('15000')} placeholderTextColor={colors.mutedForeground}
                    value={monthlyInstallment} onChangeText={setMonthlyInstallment} />
                  <View style={{ marginTop: 12 }}>
                    <DatePickerField label={t.installmentEndDate} value={installmentEndDate} onChange={setInstallmentEndDate} onClear={() => setInstallmentEndDate('')} />
                  </View>
                </View>
              )}
            </View>

            {/* Rental info (collapsible) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.collapsibleHeader, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => {
                  const next = !hasRentalInfo;
                  setHasRentalInfo(next);
                  setRentalExpanded(next);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.collapsibleTitle, { color: colors.text }]}>{t.rentalInfo}</Text>
                  <Text style={[styles.collapsibleDesc, { color: colors.mutedForeground }]}>{t.rentalInfoDesc}</Text>
                </View>
                <Feather name={hasRentalInfo ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {hasRentalInfo && rentalExpanded && (
                <View style={styles.collapsibleBody}>
                  <Text style={labelStyle}>{t.monthlyRent}</Text>
                  <AmountInput style={inputStyle} placeholder={t.exampleValue('20000')} placeholderTextColor={colors.mutedForeground}
                    value={monthlyRent}
                    onChangeText={(v) => { setMonthlyRent(v); const n = parseAmount(v); setAnnualRent(!isNaN(n) ? cleanAmountInput(String(n * 12)) : ''); }} />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.annualRent}</Text>
                  <AmountInput style={inputStyle} placeholder={t.exampleValue('240000')} placeholderTextColor={colors.mutedForeground}
                    value={annualRent}
                    onChangeText={(v) => { setAnnualRent(v); const n = parseAmount(v); setMonthlyRent(!isNaN(n) ? cleanAmountInput(String(n / 12)) : ''); }} />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.propertyStatus}</Text>
                  <View style={styles.chips}>
                    {PROPERTY_STATUSES.map(s => (
                      <Chip key={s.key} value={s.key} selected={propertyStatus === s.key} onPress={() => setPropertyStatus(s.key)}
                        label={s.label} />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Summary card */}
            {reShowSummary && (
              <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>{t.propertySummary}</Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.purchasePrice}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePurchasePriceNum.toLocaleString('en-EG')} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.purchasePricePerM2}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePurchasePricePerM2.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.currentMarketPricePerM2}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePricePerM2Num.toLocaleString('en-EG')} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.currentPropertyValue}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{reCurrentValue.toLocaleString('en-EG')} EGP</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.unrealizedGainLoss}</Text>
                  <Text style={[styles.summaryValue, { color: reGainLoss >= 0 ? colors.green : colors.red }]}>
                    {reGainLoss >= 0 ? '+' : ''}{reGainLoss.toLocaleString('en-EG', { maximumFractionDigits: 0 })} EGP
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.appreciation}</Text>
                  <Text style={[styles.summaryValue, { color: reAppreciationPct >= 0 ? colors.green : colors.red }]}>
                    {reAppreciationPct >= 0 ? '+' : ''}{reAppreciationPct.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.roi}</Text>
                  <Text style={[styles.summaryValue, { color: reROIPct >= 0 ? colors.green : colors.red }]}>
                    {reROIPct >= 0 ? '+' : ''}{reROIPct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </FormSection>
          </>)}

          {/* Personal Asset */}
          {type === 'personal_asset' && (<>
          <FormSection icon="tag" title={t.formSecItem}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.assetName}</Text>
              <TextInput style={inputStyle} placeholder={t.exampleValue('Rolex Submariner')} placeholderTextColor={colors.mutedForeground}
                value={assetName} onChangeText={setAssetName} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.category}</Text>
              <View style={styles.chips}>
                {PERSONAL_ASSET_CATEGORIES.map(c => (
                  <Chip key={c.key} value={c.key} selected={assetCategory === c.key}
                    onPress={() => setAssetCategory(c.key)} label={CATEGORY_LABELS[c.key]} />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.icon}</Text>
              <View style={styles.chips}>
                {PERSONAL_ASSET_ICONS.map(ic => {
                  const isActive = assetIcon === ic;
                  return (
                    <TouchableOpacity
                      key={ic}
                      style={[styles.iconOption, {
                        backgroundColor: isActive ? colors.primary : colors.muted,
                        borderColor: isActive ? colors.primary : colors.border,
                      }]}
                      onPress={() => { setAssetIcon(ic); setAssetIconTouched(true); }}
                    >
                      <Feather name={ic} size={17} color={isActive ? colors.primaryForeground : colors.text} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </FormSection>
          <FormSection icon="dollar-sign" title={t.formSecValue}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePrice}</Text>
              <AmountInput style={inputStyle} placeholder={t.exampleValue('250000')} placeholderTextColor={colors.mutedForeground}
                value={purchasePrice} onChangeText={setPurchasePrice} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.currentEstimatedValue}</Text>
              <AmountInput style={inputStyle} placeholder={t.defaultsToPurchasePrice}
                placeholderTextColor={colors.mutedForeground}
                value={currentValue} onChangeText={setCurrentValue} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.assetCurrency}</Text>
              <View style={styles.chips}>
                {(['EGP', 'USD'] as PersonalAssetCurrency[]).map(c => (
                  <Chip key={c} value={c} selected={assetCurrency === c} onPress={() => setAssetCurrency(c)} />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <DatePickerField label={t.purchaseDate} value={assetPurchaseDate} onChange={setAssetPurchaseDate} />
            </View>
          </FormSection>
          </>)}

          {/* Fixed Income */}
          {type === 'fixed_income' && (<>
          <FormSection icon="briefcase" title={t.formSecCertificate}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiSubtype}</Text>
              <View style={styles.chips}>
                {([
                  { key: 'tbill', label: t.tbill },
                  { key: 'saving_cert', label: t.savingCert },
                  { key: 'deposit', label: t.deposit },
                  { key: 'sukuk', label: t.sukuk },
                ] as { key: FixedIncomeSubtype; label: string }[]).map(s => (
                  <Chip key={s.key} value={s.key} selected={fiSubtype === s.key}
                    onPress={() => setFiSubtype(s.key)} label={s.label} />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiLabel}</Text>
              <TextInput style={inputStyle} placeholder={t.fiLabelPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={fiLabel} onChangeText={setFiLabel} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiInstitution}</Text>
              <TextInput style={inputStyle} placeholder={t.fiInstitutionPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={fiInstitution} onChangeText={setFiInstitution} />
            </View>
          </FormSection>
          <FormSection icon="percent" title={t.formSecAmountRate}>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiPrincipal}</Text>
              <AmountInput style={inputStyle} placeholder={t.exampleValue('100000')}
                placeholderTextColor={colors.mutedForeground}
                value={fiPrincipal} onChangeText={setFiPrincipal} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiAnnualRate}</Text>
              <AmountInput style={inputStyle} placeholder={t.fiAnnualRatePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={fiAnnualRate} onChangeText={setFiAnnualRate} />
            </View>
          </FormSection>
          <FormSection icon="calendar" title={t.formSecDates}>
            <View style={styles.section}>
              <DatePickerField label={t.fiPurchaseDate} value={fiPurchaseDate} onChange={setFiPurchaseDate} />
            </View>
            <View style={styles.section}>
              <DatePickerField label={t.fiMaturityDate} value={fiMaturityDate} onChange={setFiMaturityDate} maxDate={new Date(new Date().setFullYear(new Date().getFullYear() + 30))} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.fiPaymentFrequency}</Text>
              <View style={styles.chips}>
                {([
                  { key: 'monthly', label: t.fiMonthly },
                  { key: 'quarterly', label: t.fiQuarterly },
                  { key: 'at_maturity', label: t.fiAtMaturity },
                ] as { key: PaymentFrequency; label: string }[]).map(f => (
                  <Chip key={f.key} value={f.key} selected={fiPaymentFrequency === f.key}
                    onPress={() => setFiPaymentFrequency(f.key)} label={f.label} />
                ))}
              </View>
            </View>

            {/* Loan against this certificate (collapsible) — only meaningful
                once the certificate itself already exists, so this section
                is hidden while adding a brand-new one. */}
            {!!editingHolding && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.collapsibleHeader, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                  onPress={() => {
                    const next = !hasLoan;
                    setHasLoan(next);
                    setLoanExpanded(next);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.collapsibleTitle, { color: colors.text }]}>{t.linkedLoanTitle}</Text>
                    <Text style={[styles.collapsibleDesc, { color: colors.mutedForeground }]}>{t.linkedLoanDesc}</Text>
                  </View>
                  <Feather name={hasLoan ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                {hasLoan && loanExpanded && (
                  <View style={styles.collapsibleBody}>
                    <Text style={labelStyle}>{t.loanOutstandingBalance}</Text>
                    <AmountInput style={inputStyle} placeholder={t.exampleValue('80000')} placeholderTextColor={colors.mutedForeground}
                      value={loanOutstandingBalance} onChangeText={setLoanOutstandingBalance} />
                    <Text style={[labelStyle, { marginTop: 12 }]}>{t.loanMonthlyInstallment}</Text>
                    <AmountInput style={inputStyle} placeholder={t.exampleValue('5000')} placeholderTextColor={colors.mutedForeground}
                      value={loanMonthlyInstallment} onChangeText={setLoanMonthlyInstallment} />
                    <View style={{ marginTop: 12 }}>
                      <DatePickerField label={t.loanStartDate} value={loanStartDate} onChange={setLoanStartDate} />
                    </View>
                    <Text style={[labelStyle, { marginTop: 12 }]}>{t.loanFundingAccount}</Text>
                    <Text style={[styles.collapsibleDesc, { color: colors.mutedForeground, marginBottom: 8 }]}>{t.loanFundingAccountDesc}</Text>
                    {cashAccounts.length === 0 ? (
                      <Text style={{ color: colors.mutedForeground }}>{t.noCashAccounts}</Text>
                    ) : (
                      <View style={styles.chips}>
                        {cashAccounts.map(a => (
                          <Chip key={a.id} value={a.id} selected={loanFundingCashAccountId === a.id}
                            onPress={() => setLoanFundingCashAccountId(a.id === loanFundingCashAccountId ? undefined : a.id)}
                            label={a.accountName} />
                        ))}
                      </View>
                    )}
                    <Text style={[labelStyle, { marginTop: 12 }]}>{t.notes}</Text>
                    <TextInput style={inputStyle} placeholder={t.loanNotesPlaceholder} placeholderTextColor={colors.mutedForeground}
                      value={loanNotes} onChangeText={setLoanNotes} />
                  </View>
                )}
              </View>
            )}
          </FormSection>
          </>)}

          {preview && <AddInvestmentPreview rows={preview.rows} currency={preview.currency} note={preview.note} />}

          {/* Notes */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.section, { marginBottom: 0 }]}>
              <Text style={labelStyle}>{t.notes}</Text>
              <TextInput style={[inputStyle, styles.notesInput]} placeholder={t.addNote}
                placeholderTextColor={colors.mutedForeground} value={notes} onChangeText={setNotes} multiline />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.bottomSave, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.bottomSaveText, { color: colors.primaryForeground }]}>{isEditing ? t.addSaveChanges : t.addSaveInvestment}</Text>}
          </TouchableOpacity>

          </>)}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Stock Picker Modal */}
      <StockPickerModal
        visible={stockPickerVisible}
        market={stockMarket}
        selected={selectedStock}
        onSelect={(s) => { setSelectedStock(s); setCustomSymbol(''); }}
        onClose={() => setStockPickerVisible(false)}
      />

      {/* Real Estate location picker modals */}
      <SearchPickerModal
        visible={governoratePickerVisible}
        title={t.selectGovernorate}
        options={GOVERNORATE_NAMES}
        selected={governorate}
        onSelect={(v) => { setGovernorate(v); setCity(''); setDistrict(''); setAutoFilledArea(null); setCurrentMarketPricePerM2(''); }}
        onClose={() => setGovernoratePickerVisible(false)}
        otherLabel={t.enterManually}
      />
      <SearchPickerModal
        visible={cityPickerVisible}
        title={t.selectCity}
        options={citiesForGovernorate(governorate).map(c => c.name)}
        selected={city}
        onSelect={(v) => {
          setCity(v);
          setDistrict('');
          const match = lookupREArea(governorate, v, '');
          const live = liveAreaFor(match?.id);
          if (live) {
            setCurrentMarketPricePerM2(String(live.avgPricePerM2));
            setAutoFilledArea(live);
          } else {
            // No real scraped price for this area — leave the field for the
            // user rather than seeding a figure we can't stand behind.
            setAutoFilledArea(null);
          }
        }}
        onClose={() => setCityPickerVisible(false)}
        otherLabel={t.enterManually}
      />
      <SearchPickerModal
        visible={districtPickerVisible}
        title={t.selectDistrict}
        options={districtsForCity(governorate, city)}
        selected={district}
        onSelect={(v) => {
          setDistrict(v);
          const match = lookupREArea(governorate, city, v);
          const live = liveAreaFor(match?.id);
          if (live) {
            setCurrentMarketPricePerM2(String(live.avgPricePerM2));
            setAutoFilledArea(live);
          } else {
            setAutoFilledArea(null);
          }
        }}
        onClose={() => setDistrictPickerVisible(false)}
        otherLabel={t.enterManually}
      />

      {/* Real estate compound/developer picker */}
      <CompoundPickerModal
        visible={compoundPickerVisible}
        selectedId={reCompoundId}
        onSelect={(c) => {
          setCompoundName(c.name);
          setDeveloper(c.developer);
          setReCompoundId(c.id);
          setGovernorate(c.governorate);
          setCity('');
          setDistrict('');
          const live = compoundPrices.find(cp => cp.id === c.id);
          if (live?.avgPricePerM2 != null) setCurrentMarketPricePerM2(String(live.avgPricePerM2));
          // Also links to the compound's parent area (when known) so this
          // holding keeps revaluing over time the same way area-only
          // holdings do (see rePrice.ts) — without this a compound-based
          // holding would never update again after today.
          if (c.areaId) {
            const live = liveAreaFor(c.areaId);
            if (live) setAutoFilledArea(live);
          }
        }}
        onFreeText={(text) => { setCompoundName(text); setReCompoundId(undefined); }}
        onClose={() => setCompoundPickerVisible(false)}
      />
    </>
  );
}

/** One titled card of the Add investment form. Sections inside keep their
 *  own 16pt bottom margin, so the card drops its bottom padding. */
function FormSection({ icon, title, children }: { icon: keyof typeof Feather.glyphMap; title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.formCard, styles.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.formSectionHeader}>
        <View style={[styles.formSectionIcon, { backgroundColor: colors.primary + '1A' }]}>
          <Feather name={icon} size={13} color={colors.primary} />
        </View>
        <Text style={[styles.formSectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  section: { marginBottom: 16 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  formSection: { paddingBottom: 0, marginBottom: 12 },
  formSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  formSectionIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  formSectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8, letterSpacing: 0.3 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 13, paddingVertical: 10,
  },
  typeChipLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsScroll: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  iconOption: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  todayPriceBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10, maxWidth: '100%' },
  todayPriceText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  bottomSave: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8 },
  bottomSaveText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  hintText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 15 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 8,
  },
  warningText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 16 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  saveButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  dropdownAvatar: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownAvatarText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  dropdownInfo: { flex: 1 },
  dropdownSymbol: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  dropdownName: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  customDivider: { flex: 1, height: StyleSheet.hairlineWidth },
  customOr: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  // Collapsible sections (Real Estate — installment / rental)
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  collapsibleTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 3 },
  collapsibleDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  collapsibleBody: { marginTop: 12, gap: 4 },
  // Summary card (Real Estate)
  summaryCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  summaryDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6 },
  summaryLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

const pickerStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  countLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', paddingHorizontal: 16, paddingVertical: 8 },
  stockRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 13,
  },
  stockRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: {
    width: 42, height: 42, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
  stockInfo: { flex: 1 },
  symbol: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  stockName: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
});
