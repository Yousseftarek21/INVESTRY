import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHoldings } from '@/context/HoldingsContext';
import { GoldKarat, Holding, MetalForm, PropertyType } from '@/types';

type InvestmentType = 'gold' | 'silver' | 'stock' | 'real_estate';

const EGX_SYMBOLS = [
  { symbol: 'COMI', name: 'Commercial Intl Bank' },
  { symbol: 'HRHO', name: 'EFG Hermes Holding' },
  { symbol: 'TMGH', name: 'Talaat Moustafa Group' },
  { symbol: 'ORWE', name: 'Oriental Weavers' },
  { symbol: 'EAST', name: 'Eastern Company' },
  { symbol: 'ORAS', name: 'Orascom Construction' },
  { symbol: 'CLHO', name: 'Cleopatra Hospital' },
  { symbol: 'EKHO', name: 'EK Holding' },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function AddInvestmentScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { addHolding } = useHoldings();

  const [type, setType] = useState<InvestmentType>('gold');
  const [karat, setKarat] = useState<GoldKarat>('21k');
  const [form, setForm] = useState<MetalForm>('physical');
  const [grams, setGrams] = useState('');
  const [purchasePricePerGram, setPurchasePricePerGram] = useState('');
  const [selectedStock, setSelectedStock] = useState(EGX_SYMBOLS[0]);
  const [customSymbol, setCustomSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [purchasePricePerShare, setPurchasePricePerShare] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [location, setLocation] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [notes, setNotes] = useState('');

  const inputStyle = [styles.input, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }];
  const labelStyle = [styles.label, { color: colors.mutedForeground }];

  const KARATS: GoldKarat[] = ['24k', '22k', '21k', '18k'];

  const TYPES: { key: InvestmentType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
    { key: 'gold', label: t.gold, icon: 'award', color: colors.primary },
    { key: 'silver', label: t.silver, icon: 'circle', color: colors.silverColor },
    { key: 'stock', label: t.egxStock, icon: 'bar-chart-2', color: '#4A9EFF' },
    { key: 'real_estate', label: t.realEstate, icon: 'home', color: '#A47FCA' },
  ];

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

  const handleSave = async () => {
    let holding: Holding | null = null;
    const today = new Date().toISOString().split('T')[0];

    if (type === 'gold') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id: generateId(), type: 'gold', karat, form, grams: parseFloat(grams), purchasePricePerGram: parseFloat(purchasePricePerGram), purchaseDate: today, notes };
    } else if (type === 'silver') {
      if (!grams || !purchasePricePerGram) { Alert.alert(t.missingFields, t.enterGramsAndPrice); return; }
      holding = { id: generateId(), type: 'silver', form, grams: parseFloat(grams), purchasePricePerGram: parseFloat(purchasePricePerGram), purchaseDate: today, notes };
    } else if (type === 'stock') {
      if (!shares || !purchasePricePerShare) { Alert.alert(t.missingFields, t.enterSharesAndPrice); return; }
      const sym = customSymbol.trim().toUpperCase() || selectedStock.symbol;
      const name = customSymbol.trim() ? customSymbol.trim().toUpperCase() : selectedStock.name;
      holding = { id: generateId(), type: 'stock', symbol: sym, companyName: name, shares: parseFloat(shares), purchasePricePerShare: parseFloat(purchasePricePerShare), purchaseDate: today, notes };
    } else if (type === 'real_estate') {
      if (!purchasePrice || !currentValue) { Alert.alert(t.missingFields, t.enterPrices); return; }
      holding = { id: generateId(), type: 'real_estate', propertyType, location, purchasePrice: parseFloat(purchasePrice), currentValue: parseFloat(currentValue), purchaseDate: today, notes };
    }

    if (!holding) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addHolding(holding);
    router.back();
  };

  const topInsets = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botInsets = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
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
        <Text style={[styles.modalTitle, { color: colors.text }]}>{t.addInvestment}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveBtnText, { color: colors.primary }]}>{t.save}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: botInsets + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type */}
        <View style={styles.section}>
          <Text style={labelStyle}>{t.investmentType}</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(tp => (
              <TouchableOpacity
                key={tp.key}
                style={[styles.typeCard, {
                  backgroundColor: type === tp.key ? tp.color + '22' : colors.card,
                  borderColor: type === tp.key ? tp.color : colors.border,
                }]}
                onPress={() => setType(tp.key)}
              >
                <Feather name={tp.icon} size={20} color={type === tp.key ? tp.color : colors.mutedForeground} />
                <Text style={[styles.typeLabel, { color: type === tp.key ? tp.color : colors.text }]}>{tp.label}</Text>
              </TouchableOpacity>
            ))}
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
            <View style={styles.stockGrid}>
              {EGX_SYMBOLS.map(s => (
                <Chip key={s.symbol} value={s.symbol} selected={selectedStock.symbol === s.symbol && !customSymbol}
                  onPress={() => { setSelectedStock(s); setCustomSymbol(''); }} />
              ))}
            </View>
            <TextInput style={[inputStyle, { marginTop: 8 }]} placeholder={t.customSymbol}
              placeholderTextColor={colors.mutedForeground} value={customSymbol}
              onChangeText={setCustomSymbol} autoCapitalize="characters" />
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
            <Text style={labelStyle}>{t.propertyType}</Text>
            <View style={styles.chips}>
              {(['apartment', 'villa', 'land', 'commercial'] as PropertyType[]).map(p => (
                <Chip key={p} value={p} selected={propertyType === p} onPress={() => setPropertyType(p)}
                  label={t[p as 'apartment' | 'villa' | 'land' | 'commercial']} />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={labelStyle}>{t.location}</Text>
            <TextInput style={inputStyle} placeholder="e.g. New Cairo" placeholderTextColor={colors.mutedForeground}
              value={location} onChangeText={setLocation} />
          </View>
          <View style={styles.section}>
            <Text style={labelStyle}>{t.purchasePrice}</Text>
            <TextInput style={inputStyle} placeholder="e.g. 3500000" placeholderTextColor={colors.mutedForeground}
              value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" />
          </View>
          <View style={styles.section}>
            <Text style={labelStyle}>{t.currentEstimatedValue}</Text>
            <TextInput style={inputStyle} placeholder="e.g. 4200000" placeholderTextColor={colors.mutedForeground}
              value={currentValue} onChangeText={setCurrentValue} keyboardType="decimal-pad" />
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
          <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>{t.addInvestment}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  stockGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  saveButtonText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
