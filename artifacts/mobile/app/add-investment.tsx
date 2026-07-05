import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useHaptic } from '@/hooks/useHaptic';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { useCash } from '@/context/CashContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { CashAccount, CashAccountType, GoldKarat, Holding, MetalForm, PersonalAssetCategory, PersonalAssetCurrency, PropertyStatus, PropertyType, ValuationSource } from '@/types';
import { citiesForGovernorate, districtsForCity, GOVERNORATE_NAMES } from '@/data/egypt-locations';

const FREE_LIMIT = 5;

type InvestmentType = 'gold' | 'silver' | 'stock' | 'real_estate' | 'personal_asset';
type AddScreenMode = 'choose' | 'investment' | 'cash';

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

// ─── All major EGX listed stocks (deduplicated by symbol) ─────────────────────
const EGX_SYMBOLS_RAW = [
  { symbol: 'COMI', name: 'Commercial International Bank' },
  { symbol: 'HRHO', name: 'EFG Hermes Holding' },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group' },
  { symbol: 'ORWE', name: 'Oriental Weavers' },
  { symbol: 'EAST', name: 'Eastern Company' },
  { symbol: 'ORAS', name: 'Orascom Construction' },
  { symbol: 'CLHO', name: 'Cleopatra Hospital Group' },
  { symbol: 'EKHO', name: 'EK Holding' },
  { symbol: 'ABUK', name: 'Abu Kir Fertilizers' },
  { symbol: 'ACGC', name: 'Alexandria Container & Cargo' },
  { symbol: 'ADIB', name: 'Abu Dhabi Islamic Bank Egypt' },
  { symbol: 'AIVC', name: 'Arabia Investments' },
  { symbol: 'ALEX', name: 'Alexandria Mineral Oils' },
  { symbol: 'AMOC', name: 'Alexandria Petroleum' },
  { symbol: 'AMER', name: 'Americana Restaurants' },
  { symbol: 'ARAB', name: 'Arab Bank Egypt' },
  { symbol: 'ARKI', name: 'Ark Investment & Real Estate' },
  { symbol: 'ASCM', name: 'Alexandria Spinning & Weaving' },
  { symbol: 'AUTO', name: 'Egyptian Automotive' },
  { symbol: 'BFED', name: 'Banque du Caire' },
  { symbol: 'BMOB', name: 'Banque Misr' },
  { symbol: 'BMOS', name: 'Bank of Alexandria' },
  { symbol: 'BRCI', name: 'Beltone Financial Holding' },
  { symbol: 'BTFH', name: 'Beltone Capital Holding' },
  { symbol: 'CCAP', name: 'Cairo Capital Holding' },
  { symbol: 'CCFH', name: 'Cairo for Housing & Development' },
  { symbol: 'CCSM', name: 'Ceramica Cleopatra Group' },
  { symbol: 'CIEB', name: 'CIB Egypt' },
  { symbol: 'CIRA', name: 'CIRA Education' },
  { symbol: 'COMD', name: 'Commercial Warehousing' },
  { symbol: 'CPTH', name: 'Cairo Pharmaceuticals' },
  { symbol: 'DCRC', name: 'Delta Construction & Rebuilding' },
  { symbol: 'DSCR', name: 'Discover Vision Group' },
  { symbol: 'DYSE', name: 'Dice Sport & Casual Wear' },
  { symbol: 'EAIG', name: 'Egypt Insurance Group' },
  { symbol: 'EALY', name: 'Egyptian Aluminium' },
  { symbol: 'ECAP', name: 'Egyptian Capital Holding' },
  { symbol: 'ECAR', name: 'Egypt Car' },
  { symbol: 'ECHO', name: 'Egyptian Company for Hotels' },
  { symbol: 'EDBE', name: 'Egyptian Arab Development Bank' },
  { symbol: 'EFID', name: 'Egyptian Financial & Industrial' },
  { symbol: 'EGTS', name: 'Egyptian Tourism' },
  { symbol: 'ELKA', name: 'El Kahera Housing' },
  { symbol: 'ELSH', name: 'El Shams Housing' },
  { symbol: 'ELWS', name: 'El Wady Ceramics' },
  { symbol: 'EMFD', name: 'Egypt Foods Group' },
  { symbol: 'EMIC', name: 'Egyptian Media Production City' },
  { symbol: 'ENPI', name: "Egyptian Nat'l Posts" },
  { symbol: 'ESRS', name: 'Ezz Steel' },
  { symbol: 'ETRS', name: 'Egyptian Transport' },
  { symbol: 'EXPA', name: 'Export Development Bank' },
  { symbol: 'FWRY', name: 'Fawry Banking & Payment Tech' },
  { symbol: 'GAMA', name: 'Ghabbour Auto' },
  { symbol: 'GBCO', name: 'General Buildings' },
  { symbol: 'GTHE', name: 'GTHE' },
  { symbol: 'GWIC', name: 'Gulf Western Investments' },
  { symbol: 'HDBK', name: 'Housing & Development Bank' },
  { symbol: 'HELI', name: 'Heliopolis Housing' },
  { symbol: 'HERO', name: 'Egyptian Real Estate Group' },
  { symbol: 'ICON', name: 'Icon Real Estate' },
  { symbol: 'IDEG', name: 'IDEG' },
  { symbol: 'IFAP', name: 'Integrated Finance' },
  { symbol: 'IRAX', name: 'Arabia Real Estate' },
  { symbol: 'ISPH', name: 'Ismailia for Real Estate Inv.' },
  { symbol: 'JUFO', name: 'Juhayna Food Industries' },
  { symbol: 'KABO', name: 'Kafr El Zayat Pesticides' },
  { symbol: 'KFSB', name: 'El Kahera El Watania Inv.' },
  { symbol: 'LCSW', name: 'Lecico Egypt' },
  { symbol: 'MASR', name: 'Misr Insurance Holding' },
  { symbol: 'MCIT', name: 'Misr Chemical Industries' },
  { symbol: 'MEDC', name: 'Middle East Glass' },
  { symbol: 'MNHD', name: 'Madinet Nasr for Housing' },
  { symbol: 'MOSI', name: 'Mosharaka Ins. & Reinsurance' },
  { symbol: 'MPCI', name: 'Misr Petroleum' },
  { symbol: 'MRSE', name: 'Maser Shipping' },
  { symbol: 'NASR', name: 'Nasr City Housing' },
  { symbol: 'NCGR', name: 'National Co. for Glass' },
  { symbol: 'NGAS', name: 'National Gas & Mining' },
  { symbol: 'NTGL', name: 'National Textile' },
  { symbol: 'OCDI', name: 'Orascom Development Egypt' },
  { symbol: 'ORAM', name: 'Orascom Media' },
  { symbol: 'ORHD', name: 'Orascom Hotels & Development' },
  { symbol: 'ORPD', name: 'Orascom Development' },
  { symbol: 'PHDC', name: 'Palm Hills Developments' },
  { symbol: 'PORT', name: 'Alexandria Port Said' },
  { symbol: 'POUL', name: 'Cairo Poultry' },
  { symbol: 'RAIA', name: 'Raia Medical Center' },
  { symbol: 'RCYC', name: 'Recyclomed' },
  { symbol: 'SDCH', name: 'Sidi Kerir Petrochemicals' },
  { symbol: 'SEMG', name: 'Americana Group Egypt' },
  { symbol: 'SKPC', name: 'Sidi Kerir Petrochem' },
  { symbol: 'SMFR', name: 'Samcrete Egypt' },
  { symbol: 'SPMD', name: 'Speed Medical' },
  { symbol: 'SUGR', name: 'Upper Egypt Sugar' },
  { symbol: 'SWDY', name: 'El Sewedy Electric' },
  { symbol: 'TMHC', name: 'Trans Ocean Hotels' },
  { symbol: 'TOYS', name: 'Toys Home' },
  { symbol: 'UEGC', name: 'United Egypt Group' },
  { symbol: 'UNIT', name: 'United Housing & Development' },
  { symbol: 'UTAC', name: 'United Arab Contractors' },
  { symbol: 'VIOS', name: 'Viossi' },
  { symbol: 'WATA', name: 'Wataniya Insurance' },
  { symbol: 'WMCK', name: 'Wadi Kom Ombo' },
  { symbol: 'ZCAP', name: 'Zap Capital' },
  { symbol: 'ZNHO', name: 'Zahraa Nasr City' },
];

// Deduplicate by symbol — keeps first occurrence
const seen = new Set<string>();
const EGX_SYMBOLS = EGX_SYMBOLS_RAW.filter(s => {
  if (seen.has(s.symbol)) return false;
  seen.add(s.symbol);
  return true;
});

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// ─── Stock Picker Modal ───────────────────────────────────────────────────────

function StockPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: { symbol: string; name: string };
  onSelect: (s: { symbol: string; name: string }) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return EGX_SYMBOLS;
    return EGX_SYMBOLS.filter(
      s => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaProvider>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[pickerStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <Text style={[pickerStyles.title, { color: colors.text }]}>EGX Stocks</Text>
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
              placeholder="Search symbol or company..."
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
          {filtered.length} stocks listed
        </Text>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.symbol}_${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item, index }) => {
            const isSelected = selected.symbol === item.symbol;
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
                <View style={[pickerStyles.avatar, {
                  backgroundColor: isSelected ? colors.primary + '25' : colors.muted,
                  borderColor: isSelected ? colors.primary + '60' : colors.border,
                }]}>
                  <Text style={[pickerStyles.avatarText, { color: isSelected ? colors.primary : colors.mutedForeground }]}>
                    {item.symbol.substring(0, 4)}
                  </Text>
                </View>
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
              placeholder="Search..."
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
  const { addCashAccount } = useCash();
  const { isPro, launchAccess, showPaywall } = useSubscription();
  const { isSignedIn } = useAuth();
  const { holdingId } = useLocalSearchParams<{ holdingId?: string }>();

  const editingHolding = holdingId ? holdings.find(h => h.id === holdingId) ?? null : null;
  const isEditing = editingHolding !== null;

  const [screenMode, setScreenMode] = useState<AddScreenMode>(isEditing ? 'investment' : 'choose');

  const [cashType, setCashType] = useState<CashAccountType>('bank');
  const [cashAccountName, setCashAccountName] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [cashCurrency, setCashCurrency] = useState('EGP');

  const [type, setType] = useState<InvestmentType>('gold');
  const [karat, setKarat] = useState<GoldKarat>('21k');
  const [form, setForm] = useState<MetalForm>('physical');
  const [grams, setGrams] = useState('');
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('');
  const [selectedStock, setSelectedStock] = useState(EGX_SYMBOLS[0]);
  const [customSymbol, setCustomSymbol] = useState('');
  const [stockPickerVisible, setStockPickerVisible] = useState(false);
  const [shares, setShares] = useState('');
  const [purchasePricePerShare, setPurchasePricePerShare] = useState('');
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
  const [lastValuationDate, setLastValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuationSource, setValuationSource] = useState<ValuationSource>('manual');
  const [developer, setDeveloper] = useState('');
  const [compoundName, setCompoundName] = useState('');
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
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState<PersonalAssetCategory>('watches');
  const [assetIcon, setAssetIcon] = useState<string>('watch');
  const [assetCurrency, setAssetCurrency] = useState<PersonalAssetCurrency>('EGP');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [assetIconTouched, setAssetIconTouched] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (!editingHolding) return;
    setType(editingHolding.type as InvestmentType);
    setNotes(editingHolding.notes ?? '');
    if (editingHolding.type === 'gold') {
      setKarat(editingHolding.karat);
      setForm(editingHolding.form);
      setGrams(String(editingHolding.grams));
      setPurchasePricePerGram(String(editingHolding.purchasePricePerGram));
    } else if (editingHolding.type === 'silver') {
      setForm(editingHolding.form);
      setGrams(String(editingHolding.grams));
      setPurchasePricePerGram(String(editingHolding.purchasePricePerGram));
    } else if (editingHolding.type === 'stock') {
      const match = EGX_SYMBOLS.find(s => s.symbol === editingHolding.symbol);
      if (match) { setSelectedStock(match); setCustomSymbol(''); }
      else setCustomSymbol(editingHolding.symbol);
      setShares(String(editingHolding.shares));
      setPurchasePricePerShare(String(editingHolding.purchasePricePerShare));
    } else if (editingHolding.type === 'real_estate') {
      setPropertyType(editingHolding.propertyType);
      setPropertyName(editingHolding.propertyName);
      setGovernorate(editingHolding.governorate);
      setCity(editingHolding.city);
      setDistrict(editingHolding.district);
      setArea(String(editingHolding.area));
      setCurrentMarketPricePerM2(String(editingHolding.currentMarketPricePerM2));
      setLastValuationDate(editingHolding.lastValuationDate ?? new Date().toISOString().split('T')[0]);
      setValuationSource(editingHolding.valuationSource ?? 'manual');
      setPurchasePrice(String(editingHolding.purchasePrice));
      setRealEstatePurchaseDate(editingHolding.purchaseDate);
      setDeveloper(editingHolding.developer ?? '');
      setCompoundName(editingHolding.compoundName ?? '');
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
      setAssetName(editingHolding.name);
      setAssetCategory(editingHolding.category);
      setAssetIcon(editingHolding.icon);
      setAssetIconTouched(true);
      setPurchasePrice(String(editingHolding.purchasePrice));
      setCurrentValue(String(editingHolding.currentValue));
      setAssetCurrency(editingHolding.currency);
      setAssetPurchaseDate(editingHolding.purchaseDate);
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

  const TYPES: { key: InvestmentType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
    { key: 'gold', label: t.gold, icon: 'award', color: colors.primary },
    { key: 'silver', label: t.silver, icon: 'circle', color: colors.silverColor },
    { key: 'stock', label: t.egxStock, icon: 'bar-chart-2', color: '#4A9EFF' },
    { key: 'real_estate', label: t.realEstate, icon: 'home', color: '#A47FCA' },
    { key: 'personal_asset', label: t.personalAsset, icon: 'star', color: '#E08E45' },
  ];

  const CASH_TYPES: { key: CashAccountType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
    { key: 'bank', label: t.bankAccount, icon: 'credit-card', color: '#4A9EFF' },
    { key: 'cash_home', label: t.cashAtHome, icon: 'home', color: colors.primary },
    { key: 'foreign_currency', label: t.foreignCurrency, icon: 'globe', color: '#A47FCA' },
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

  const reAreaNum = parseFloat(area) || 0;
  const rePricePerM2Num = parseFloat(currentMarketPricePerM2) || 0;
  const rePurchasePriceNum = parseFloat(purchasePrice) || 0;
  const reCurrentValue = reAreaNum * rePricePerM2Num;
  const rePurchasePricePerM2 = reAreaNum > 0 ? rePurchasePriceNum / reAreaNum : 0;
  const reGainLoss = reCurrentValue - rePurchasePriceNum;
  const reAppreciationPct = rePurchasePriceNum > 0 ? (reGainLoss / rePurchasePriceNum) * 100 : 0;
  const reShowSummary = reAreaNum > 0 && rePricePerM2Num > 0 && rePurchasePriceNum > 0;

  const Chip = ({ value, selected, onPress, label }: { value: string; selected: boolean; onPress: () => void; label?: string }) => (
    <TouchableOpacity
      style={[styles.chip, {
        backgroundColor: selected ? colors.primary : colors.muted,
        borderColor: selected ? colors.primary : colors.border,
      }]}
      onPress={onPress}
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

  const handleSave = async () => {
    // Without a signed-in account there is nowhere to persist this holding —
    // catch it here before any validation so we never silently drop it.
    if (!isSignedIn) {
      promptSignInToSave();
      return;
    }

    // Free tier: max 5 investments. Launch Access always overrides this,
    // even if `isPro` hasn't resolved yet (loading/cache/network hiccup).
    if (!isEditing && !isPro && !launchAccess && holdings.length >= FREE_LIMIT) {
      showPaywall();
      return;
    }

    let holding: Holding | null = null;
    const today = editingHolding?.purchaseDate ?? new Date().toISOString().split('T')[0];
    const id = editingHolding?.id ?? generateId();

    if (type === 'gold') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id, type: 'gold', karat, form, grams: parseFloat(grams), purchasePricePerGram: parseFloat(purchasePricePerGram), purchaseDate: today, notes };
    } else if (type === 'silver') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id, type: 'silver', form, grams: parseFloat(grams), purchasePricePerGram: parseFloat(purchasePricePerGram), purchaseDate: today, notes };
    } else if (type === 'stock') {
      if (!shares || !purchasePricePerShare) { Alert.alert(t.missingFields, t.enterSharesAndPrice); return; }
      const sym = customSymbol.trim().toUpperCase() || selectedStock.symbol;
      const name = customSymbol.trim() ? customSymbol.trim().toUpperCase() : selectedStock.name;
      holding = { id, type: 'stock', symbol: sym, companyName: name, shares: parseFloat(shares), purchasePricePerShare: parseFloat(purchasePricePerShare), purchaseDate: today, notes };
    } else if (type === 'real_estate') {
      const finalGovernorate = governorate.trim();
      const finalCity = city.trim();
      const finalDistrict = district.trim();
      if (
        !propertyName.trim() || !finalGovernorate || !finalCity || !finalDistrict ||
        !area || !purchasePrice || !realEstatePurchaseDate || !currentMarketPricePerM2
      ) {
        Alert.alert(t.missingFields, t.enterRealEstateRequired);
        return;
      }
      const parsedArea = parseFloat(area);
      const parsedPricePerM2 = parseFloat(currentMarketPricePerM2);
      const computedCurrentValue = parsedArea * parsedPricePerM2;
      holding = {
        id, type: 'real_estate',
        propertyName: propertyName.trim(),
        propertyType,
        governorate: finalGovernorate,
        city: finalCity,
        district: finalDistrict,
        area: parsedArea,
        currentMarketPricePerM2: parsedPricePerM2,
        currentValue: computedCurrentValue,
        lastValuationDate: lastValuationDate || undefined,
        valuationSource,
        purchasePrice: parseFloat(purchasePrice),
        purchaseDate: realEstatePurchaseDate,
        developer: developer.trim() || undefined,
        compoundName: compoundName.trim() || undefined,
        unitNumber: unitNumber.trim() || undefined,
        hasInstallmentPlan: hasInstallmentPlan || undefined,
        downPayment: hasInstallmentPlan && downPayment ? parseFloat(downPayment) : undefined,
        remainingBalance: hasInstallmentPlan && remainingBalance ? parseFloat(remainingBalance) : undefined,
        monthlyInstallment: hasInstallmentPlan && monthlyInstallment ? parseFloat(monthlyInstallment) : undefined,
        installmentEndDate: hasInstallmentPlan && installmentEndDate ? installmentEndDate : undefined,
        monthlyRent: hasRentalInfo && monthlyRent ? parseFloat(monthlyRent) : undefined,
        propertyStatus: hasRentalInfo ? propertyStatus : undefined,
        notes,
      };
    } else if (type === 'personal_asset') {
      if (!assetName.trim() || !purchasePrice) { Alert.alert(t.missingFields, t.enterAssetDetails); return; }
      const parsedPurchasePrice = parseFloat(purchasePrice);
      const parsedCurrentValue = currentValue ? parseFloat(currentValue) : parsedPurchasePrice;
      holding = {
        id, type: 'personal_asset',
        name: assetName.trim(), category: assetCategory, icon: assetIcon,
        purchasePrice: parsedPurchasePrice, currentValue: parsedCurrentValue,
        currency: assetCurrency, purchaseDate: assetPurchaseDate || today, notes,
      };
    }

    if (!holding) return;
    notify();
    if (isEditing) {
      await updateHolding(holding);
    } else {
      await addHolding(holding);
    }
    router.back();
  };

  const handleSaveCash = async () => {
    // Without a signed-in account there is nowhere to persist this cash
    // account — catch it here before any validation so we never silently
    // drop it (the form would otherwise appear to save and then vanish).
    if (!isSignedIn) {
      promptSignInToSave();
      return;
    }

    if (!cashAccountName.trim() || !cashBalance) {
      Alert.alert(t.missingFields, t.enterAccountDetails);
      return;
    }
    const account: CashAccount = {
      id: generateId(),
      type: cashType,
      accountName: cashAccountName.trim(),
      balance: parseFloat(cashBalance),
      currency: cashCurrency,
    };
    notify();
    await addCashAccount(account);
    router.back();
  };

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
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {screenMode === 'choose' ? t.whatToAdd : screenMode === 'cash' ? t.addCashAccount : (isEditing ? 'Edit Investment' : t.addInvestment)}
          </Text>
          {screenMode === 'choose' ? (
            <View style={{ width: 22 }} />
          ) : (
            <TouchableOpacity onPress={screenMode === 'cash' ? handleSaveCash : handleSave}>
              <Text style={[styles.saveBtnText, { color: colors.primary }]}>{t.save}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: botInsets + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isEditing && screenMode !== 'choose' && (
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => setScreenMode('choose')}
              hitSlop={8}
            >
              <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
              <Text style={[styles.backRowText, { color: colors.mutedForeground }]}>{t.back}</Text>
            </TouchableOpacity>
          )}

          {/* Choose: Investment vs Cash */}
          {screenMode === 'choose' && (
            <View style={styles.chooseWrap}>
              <TouchableOpacity
                style={[styles.chooseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { impact(); setScreenMode('investment'); }}
                activeOpacity={0.8}
              >
                <View style={[styles.chooseIconWrap, { backgroundColor: colors.primary + '20' }]}>
                  <Feather name="trending-up" size={22} color={colors.primary} />
                </View>
                <View style={styles.chooseInfo}>
                  <Text style={[styles.chooseTitle, { color: colors.text }]}>{t.addInvestmentOption}</Text>
                  <Text style={[styles.chooseDesc, { color: colors.mutedForeground }]}>{t.addInvestmentOptionDesc}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chooseCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { impact(); setScreenMode('cash'); }}
                activeOpacity={0.8}
              >
                <View style={[styles.chooseIconWrap, { backgroundColor: '#4CAF5020' }]}>
                  <Feather name="dollar-sign" size={22} color="#4CAF50" />
                </View>
                <View style={styles.chooseInfo}>
                  <Text style={[styles.chooseTitle, { color: colors.text }]}>{t.addCashOption}</Text>
                  <Text style={[styles.chooseDesc, { color: colors.mutedForeground }]}>{t.addCashOptionDesc}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Cash */}
          {screenMode === 'cash' && (<>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.cashAccountType}</Text>
              <View style={styles.typeGrid}>
                {CASH_TYPES.map(ct => {
                  const isActive = cashType === ct.key;
                  return (
                    <TouchableOpacity
                      key={ct.key}
                      style={[styles.typeCard, {
                        backgroundColor: isActive ? ct.color + '22' : colors.card,
                        borderColor: isActive ? ct.color : colors.border,
                      }]}
                      onPress={() => setCashType(ct.key)}
                      activeOpacity={0.7}
                    >
                      <Feather name={ct.icon} size={20} color={isActive ? ct.color : colors.mutedForeground} />
                      <Text style={[styles.typeLabel, { color: isActive ? ct.color : colors.text }]}>{ct.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.accountName}</Text>
              <TextInput style={inputStyle} placeholder={t.accountNamePlaceholder} placeholderTextColor={colors.mutedForeground}
                value={cashAccountName} onChangeText={setCashAccountName} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.balance}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 25000" placeholderTextColor={colors.mutedForeground}
                value={cashBalance} onChangeText={setCashBalance} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.accountCurrency}</Text>
              <View style={styles.chips}>
                {CURRENCIES.map(c => (
                  <Chip key={c} value={c} selected={cashCurrency === c} onPress={() => setCashCurrency(c)} />
                ))}
              </View>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveCash} activeOpacity={0.85}>
              <Feather name="check" size={20} color={colors.primaryForeground} />
              <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>{t.addCashAccount}</Text>
            </TouchableOpacity>
          </>)}

          {/* Investment */}
          {screenMode === 'investment' && (<>
          {/* Type */}
          <View style={styles.section}>
            <Text style={labelStyle}>{t.investmentType}</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(tp => {
                const isActive = type === tp.key;
                const isDisabled = isEditing && !isActive;
                return (
                  <TouchableOpacity
                    key={tp.key}
                    style={[styles.typeCard, {
                      backgroundColor: isActive ? tp.color + '22' : colors.card,
                      borderColor: isActive ? tp.color : colors.border,
                      opacity: isDisabled ? 0.35 : 1,
                    }]}
                    onPress={() => { if (!isEditing) setType(tp.key); }}
                    activeOpacity={isEditing ? 1 : 0.7}
                  >
                    <Feather name={tp.icon} size={20} color={isActive ? tp.color : colors.mutedForeground} />
                    <Text style={[styles.typeLabel, { color: isActive ? tp.color : colors.text }]}>{tp.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Gold */}
          {type === 'gold' && (<>
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
            <View style={styles.section}>
              <Text style={labelStyle}>{t.weightGrams}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 50" placeholderTextColor={colors.mutedForeground}
                value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePricePerGram}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 3900" placeholderTextColor={colors.mutedForeground}
                value={purchasePricePerGram} onChangeText={setPurchasePricePerGram} keyboardType="decimal-pad" />
            </View>
          </>)}

          {/* Silver */}
          {type === 'silver' && (<>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.form}</Text>
              <View style={styles.chips}>
                {(['physical', 'digital'] as MetalForm[]).map(f => (
                  <Chip key={f} value={f} selected={form === f} onPress={() => setForm(f)}
                    label={f === 'physical' ? t.physical : t.digital} />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.weightGrams}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 500" placeholderTextColor={colors.mutedForeground}
                value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePricePerGram}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 52" placeholderTextColor={colors.mutedForeground}
                value={purchasePricePerGram} onChangeText={setPurchasePricePerGram} keyboardType="decimal-pad" />
            </View>
          </>)}

          {/* Stock */}
          {type === 'stock' && (<>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.stockSymbol}</Text>

              {/* Dropdown trigger */}
              <TouchableOpacity
                style={[styles.dropdownTrigger, { backgroundColor: colors.card, borderColor: colors.primary }]}
                onPress={() => { impact(); setStockPickerVisible(true); }}
                activeOpacity={0.75}
              >
                <View style={[styles.dropdownAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.dropdownAvatarText, { color: colors.primary }]}>
                    {activeStock.symbol.substring(0, 4)}
                  </Text>
                </View>
                <View style={styles.dropdownInfo}>
                  <Text style={[styles.dropdownSymbol, { color: colors.text }]}>{activeStock.symbol}</Text>
                  <Text style={[styles.dropdownName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {activeStock.name}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {/* Custom symbol override */}
              <View style={styles.customRow}>
                <View style={[styles.customDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.customOr, { color: colors.mutedForeground }]}>or enter custom</Text>
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
            <View style={styles.section}>
              <Text style={labelStyle}>{t.numberOfShares}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 100" placeholderTextColor={colors.mutedForeground}
                value={shares} onChangeText={setShares} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePricePerShare}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 95.50" placeholderTextColor={colors.mutedForeground}
                value={purchasePricePerShare} onChangeText={setPurchasePricePerShare} keyboardType="decimal-pad" />
            </View>
          </>)}

          {/* Real Estate */}
          {type === 'real_estate' && (<>
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

            {/* Location */}
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

            <View style={styles.section}>
              <Text style={labelStyle}>{t.area}</Text>
              <TextInput style={inputStyle} placeholder={t.areaPlaceholder} placeholderTextColor={colors.mutedForeground}
                value={area} onChangeText={setArea} keyboardType="decimal-pad" />
            </View>

            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePrice}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 3500000" placeholderTextColor={colors.mutedForeground}
                value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchaseDate}</Text>
              <TextInput style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                value={realEstatePurchaseDate} onChangeText={setRealEstatePurchaseDate} />
            </View>

            <View style={styles.section}>
              <Text style={labelStyle}>{t.currentMarketPricePerM2}</Text>
              <TextInput style={inputStyle} placeholder={t.currentMarketPricePerM2Placeholder} placeholderTextColor={colors.mutedForeground}
                value={currentMarketPricePerM2} onChangeText={setCurrentMarketPricePerM2} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.lastValuationDate}</Text>
              <TextInput style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                value={lastValuationDate} onChangeText={setLastValuationDate} />
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

            {/* Purchase info */}
            <View style={styles.section}>
              <Text style={labelStyle}>{t.developer}</Text>
              <TextInput style={inputStyle} placeholder={t.developerPlaceholder} placeholderTextColor={colors.mutedForeground}
                value={developer} onChangeText={setDeveloper} />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.compoundName}</Text>
              <TextInput style={inputStyle} placeholder={t.compoundNamePlaceholder} placeholderTextColor={colors.mutedForeground}
                value={compoundName} onChangeText={setCompoundName} />
            </View>
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
                  <TextInput style={inputStyle} placeholder="e.g. 500000" placeholderTextColor={colors.mutedForeground}
                    value={downPayment} onChangeText={setDownPayment} keyboardType="decimal-pad" />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.remainingBalance}</Text>
                  <TextInput style={inputStyle} placeholder="e.g. 2000000" placeholderTextColor={colors.mutedForeground}
                    value={remainingBalance} onChangeText={setRemainingBalance} keyboardType="decimal-pad" />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.monthlyInstallment}</Text>
                  <TextInput style={inputStyle} placeholder="e.g. 15000" placeholderTextColor={colors.mutedForeground}
                    value={monthlyInstallment} onChangeText={setMonthlyInstallment} keyboardType="decimal-pad" />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.installmentEndDate}</Text>
                  <TextInput style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                    value={installmentEndDate} onChangeText={setInstallmentEndDate} />
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
                  <TextInput style={inputStyle} placeholder="e.g. 20000" placeholderTextColor={colors.mutedForeground}
                    value={monthlyRent}
                    onChangeText={(v) => { setMonthlyRent(v); const n = parseFloat(v); setAnnualRent(!isNaN(n) ? String(n * 12) : ''); }}
                    keyboardType="decimal-pad" />
                  <Text style={[labelStyle, { marginTop: 12 }]}>{t.annualRent}</Text>
                  <TextInput style={inputStyle} placeholder="e.g. 240000" placeholderTextColor={colors.mutedForeground}
                    value={annualRent}
                    onChangeText={(v) => { setAnnualRent(v); const n = parseFloat(v); setMonthlyRent(!isNaN(n) ? String(n / 12) : ''); }}
                    keyboardType="decimal-pad" />
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
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePurchasePriceNum.toLocaleString()} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.purchasePricePerM2}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePurchasePricePerM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.currentMarketPricePerM2}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{rePricePerM2Num.toLocaleString()} EGP</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.currentPropertyValue}</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{reCurrentValue.toLocaleString()} EGP</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryDivider, { borderTopColor: colors.border }]}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t.unrealizedGainLoss}</Text>
                  <Text style={[styles.summaryValue, { color: reGainLoss >= 0 ? colors.green : colors.red }]}>
                    {reGainLoss >= 0 ? '+' : ''}{reGainLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP
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
                  <Text style={[styles.summaryValue, { color: reAppreciationPct >= 0 ? colors.green : colors.red }]}>
                    {reAppreciationPct >= 0 ? '+' : ''}{reAppreciationPct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </>)}

          {/* Personal Asset */}
          {type === 'personal_asset' && (<>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.assetName}</Text>
              <TextInput style={inputStyle} placeholder="e.g. Rolex Submariner" placeholderTextColor={colors.mutedForeground}
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
            <View style={styles.section}>
              <Text style={labelStyle}>{t.purchasePrice}</Text>
              <TextInput style={inputStyle} placeholder="e.g. 250000" placeholderTextColor={colors.mutedForeground}
                value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.section}>
              <Text style={labelStyle}>{t.currentEstimatedValue}</Text>
              <TextInput style={inputStyle} placeholder="Defaults to purchase price if left blank"
                placeholderTextColor={colors.mutedForeground}
                value={currentValue} onChangeText={setCurrentValue} keyboardType="decimal-pad" />
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
              <Text style={labelStyle}>{t.purchaseDate}</Text>
              <TextInput style={inputStyle} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
                value={assetPurchaseDate} onChangeText={setAssetPurchaseDate} />
            </View>
          </>)}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={labelStyle}>{t.notes}</Text>
            <TextInput style={[inputStyle, styles.notesInput]} placeholder={t.addNote}
              placeholderTextColor={colors.mutedForeground} value={notes} onChangeText={setNotes} multiline />
          </View>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave} activeOpacity={0.85}>
            <Feather name="check" size={20} color={colors.primaryForeground} />
            <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>{isEditing ? 'Save Changes' : t.addInvestment}</Text>
          </TouchableOpacity>
          </>)}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Stock Picker Modal */}
      <StockPickerModal
        visible={stockPickerVisible}
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
        onSelect={(v) => { setGovernorate(v); setCity(''); setDistrict(''); }}
        onClose={() => setGovernoratePickerVisible(false)}
        otherLabel={t.enterManually}
      />
      <SearchPickerModal
        visible={cityPickerVisible}
        title={t.selectCity}
        options={citiesForGovernorate(governorate).map(c => c.name)}
        selected={city}
        onSelect={(v) => { setCity(v); setDistrict(''); }}
        onClose={() => setCityPickerVisible(false)}
        otherLabel={t.enterManually}
      />
      <SearchPickerModal
        visible={districtPickerVisible}
        title={t.selectDistrict}
        options={districtsForCity(governorate, city)}
        selected={district}
        onSelect={setDistrict}
        onClose={() => setDistrictPickerVisible(false)}
        otherLabel={t.enterManually}
      />
    </>
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
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8, letterSpacing: 0.3 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { flex: 1, minWidth: '40%', borderRadius: 12, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 6 },
  typeLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsScroll: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  iconOption: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  saveButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  // Choose screen
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' },
  backRowText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chooseWrap: { gap: 12, marginTop: 8 },
  chooseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  chooseIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chooseInfo: { flex: 1 },
  chooseTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 3 },
  chooseDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  // Dropdown
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14,
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
    borderRadius: 14, borderWidth: 1.5, padding: 14,
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
