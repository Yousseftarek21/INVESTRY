import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useMarketPrices } from '@/hooks/usePrices';
import { useEGXMarket } from '@/hooks/useEGXMarket';
import { PriceAlert, loadAlerts, addAlert, removeAlert, buildAlertPricesDict } from '@/hooks/usePriceAlerts';
import { EGX_COMPANIES } from '@/data/egx-companies';
import { parseAmount } from '@/utils/parseAmount';
import { AmountInput } from '@/components/AmountInput';

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

interface AssetOption {
  key: string;
  label: string;
  group: 'metals' | 'currency' | 'stocks';
  price: number;
}

export default function PriceAlertsScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { language } = useAppSettings();
  const { userId } = useAuth();
  const { data: prices } = useMarketPrices();
  const { data: egxStocks } = useEGXMarket();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetRaw, setTargetRaw] = useState('');

  const refreshAlerts = useCallback(async () => {
    setAlerts(await loadAlerts(userId));
  }, [userId]);

  useEffect(() => { refreshAlerts(); }, [refreshAlerts]);

  const pricesDict = useMemo(() => buildAlertPricesDict(prices, egxStocks), [prices, egxStocks]);

  const assetOptions = useMemo<AssetOption[]>(() => {
    const opts: AssetOption[] = [
      { key: 'gold_24k',    label: t.karat24label,    group: 'metals',   price: pricesDict.gold_24k ?? 0 },
      { key: 'gold_22k',    label: t.karat22label,    group: 'metals',   price: pricesDict.gold_22k ?? 0 },
      { key: 'gold_21k',    label: t.karat21label,    group: 'metals',   price: pricesDict.gold_21k ?? 0 },
      { key: 'gold_18k',    label: t.karat18label,    group: 'metals',   price: pricesDict.gold_18k ?? 0 },
      { key: 'silver_gram', label: t.silverGramLabel, group: 'metals',   price: pricesDict.silver_gram ?? 0 },
      { key: 'usd_egp',     label: t.usDollar,        group: 'currency', price: pricesDict.usd_egp ?? 0 },
    ];
    [...EGX_COMPANIES].sort((a, b) => a.ticker.localeCompare(b.ticker)).forEach(c => {
      const price = pricesDict[`stock_${c.ticker}`] ?? c.fallbackPrice;
      opts.push({
        key: `stock_${c.ticker}`,
        label: `${c.ticker} · ${language === 'ar' ? c.nameAr : c.nameEn}`,
        group: 'stocks',
        price,
      });
    });
    return opts;
  }, [pricesDict, t, language]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assetOptions;
    return assetOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [assetOptions, query]);

  const resetForm = useCallback(() => {
    setShowForm(false);
    setSelectedAsset(null);
    setDirection('above');
    setTargetRaw('');
    setQuery('');
  }, []);

  const openAdd = () => { resetForm(); setShowForm(true); };

  const handleSave = async () => {
    if (!userId) return;
    if (!selectedAsset) { Alert.alert(t.selectAssetLabel, t.selectAssetError); return; }
    const target = parseAmount(targetRaw);
    if (target <= 0) { Alert.alert(t.targetPriceLabel, t.targetPriceError); return; }
    impact(Haptics.ImpactFeedbackStyle.Light);
    await addAlert({
      id: generateId(),
      assetKey: selectedAsset.key,
      assetLabel: selectedAsset.label,
      targetPrice: target,
      direction,
      triggered: false,
      createdAt: new Date().toISOString(),
    }, userId);
    await refreshAlerts();
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!userId) return;
    if (Platform.OS === 'web') { setPendingDeleteId(id); return; }
    Alert.alert(t.deletePriceAlert, t.deletePriceAlertConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          impact(Haptics.ImpactFeedbackStyle.Medium);
          await removeAlert(id, userId);
          await refreshAlerts();
        },
      },
    ]);
  };

  const confirmWebDelete = async () => {
    if (!pendingDeleteId || !userId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await removeAlert(id, userId);
    await refreshAlerts();
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { if (showForm) resetForm(); else router.back(); }} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            {showForm ? t.addPriceAlert : t.priceAlertsLabel}
          </Text>
          {!showForm ? (
            <TouchableOpacity onPress={openAdd} hitSlop={8}>
              <Feather name="plus" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            {!showForm ? (
              alerts.length === 0 ? (
                <View style={[s.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[s.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                    <Feather name="bell" size={30} color={colors.primary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: colors.text }]}>{t.noPriceAlerts}</Text>
                  <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.noPriceAlertsHint}</Text>
                  <TouchableOpacity style={[s.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd} activeOpacity={0.85}>
                    <Feather name="plus" size={16} color={colors.primaryForeground} />
                    <Text style={[s.emptyBtnText, { color: colors.primaryForeground }]}>{t.addPriceAlert}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.list}>
                  {alerts.map(a => {
                    const current = pricesDict[a.assetKey];
                    return (
                      <SwipeToDelete key={a.id} onDelete={() => handleDelete(a.id)}>
                        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={s.cardTop}>
                            <View style={[s.cardIcon, { backgroundColor: (a.direction === 'above' ? colors.green : colors.red) + '18' }]}>
                              <Feather name={a.direction === 'above' ? 'arrow-up' : 'arrow-down'} size={18} color={a.direction === 'above' ? colors.green : colors.red} />
                            </View>
                            <View style={s.cardBody}>
                              <Text style={[s.cardName, { color: colors.text }]} numberOfLines={1}>{a.assetLabel}</Text>
                              <Text style={[s.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                                {a.direction === 'above' ? t.directionAbove : t.directionBelow} {a.targetPrice.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP
                              </Text>
                              {current != null && (
                                <Text style={[s.cardCurrent, { color: colors.mutedForeground }]} numberOfLines={1}>
                                  {t.currentPriceLabel}: {current.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP
                                </Text>
                              )}
                            </View>
                            <View style={[s.statusBadge, { backgroundColor: (a.triggered ? colors.primary : colors.mutedForeground) + '18' }]}>
                              <Text style={[s.statusText, { color: a.triggered ? colors.primary : colors.mutedForeground }]}>
                                {a.triggered ? t.alertTriggeredLabel : t.alertActiveLabel}
                              </Text>
                            </View>
                          </View>
                          <View style={s.cardActions}>
                            <TouchableOpacity
                              style={[s.actionBtn, { backgroundColor: colors.red + '12' }]}
                              onPress={() => handleDelete(a.id)}
                              hitSlop={8}
                            >
                              <Feather name="trash-2" size={13} color={colors.red} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </SwipeToDelete>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={s.form}>
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.selectAssetLabel}</Text>
                  <TouchableOpacity
                    style={[s.pickerTrigger, { backgroundColor: colors.input, borderColor: colors.border }]}
                    onPress={() => setPickerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pickerTriggerText, { color: selectedAsset ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
                      {selectedAsset ? selectedAsset.label : t.selectAssetPlaceholder}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {selectedAsset && (
                    <Text style={[s.currentHint, { color: colors.mutedForeground }]}>
                      {t.currentPriceLabel}: {selectedAsset.price.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP
                    </Text>
                  )}
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.alertDirectionLabel}</Text>
                  <View style={s.dirRow}>
                    <TouchableOpacity
                      style={[s.dirChip, { backgroundColor: direction === 'above' ? colors.green : colors.muted }]}
                      onPress={() => setDirection('above')}
                      activeOpacity={0.8}
                    >
                      <Feather name="arrow-up" size={14} color={direction === 'above' ? '#fff' : colors.mutedForeground} />
                      <Text style={[s.dirChipText, { color: direction === 'above' ? '#fff' : colors.mutedForeground }]}>{t.directionAbove}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.dirChip, { backgroundColor: direction === 'below' ? colors.red : colors.muted }]}
                      onPress={() => setDirection('below')}
                      activeOpacity={0.8}
                    >
                      <Feather name="arrow-down" size={14} color={direction === 'below' ? '#fff' : colors.mutedForeground} />
                      <Text style={[s.dirChipText, { color: direction === 'below' ? '#fff' : colors.mutedForeground }]}>{t.directionBelow}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>{t.targetPriceLabel}</Text>
                  <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <AmountInput
                      style={[s.inputFlex, { color: colors.text }]}
                      value={targetRaw}
                      onChangeText={setTargetRaw}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <Text style={[s.unit, { color: colors.mutedForeground }]}>EGP</Text>
                  </View>
                </View>

                <View style={s.btns}>
                  <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={resetForm} activeOpacity={0.8}>
                    <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.primary }]} onPress={handleSave} activeOpacity={0.85}>
                    <Text style={[s.btnSaveText, { color: colors.primaryForeground }]}>{t.save}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Asset picker modal */}
        <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
          <View style={[s.pickerContainer, { backgroundColor: colors.background }]}>
            <View style={[s.pickerHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
              <Text style={[s.pickerTitle, { color: colors.text }]}>{t.selectAssetLabel}</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={[s.pickerCloseBtn, { backgroundColor: colors.muted }]}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={[s.searchWrap, { borderBottomColor: colors.border }]}>
              <View style={[s.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="search" size={15} color={colors.mutedForeground} />
                <TextInput
                  style={[s.searchInput, { color: colors.text }]}
                  placeholder={t.selectAssetPlaceholder}
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
              data={filteredOptions}
              keyExtractor={item => item.key}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              renderItem={({ item, index }) => {
                const prevItem = filteredOptions[index - 1];
                const showGroupHeader = !prevItem || prevItem.group !== item.group;
                const groupLabel = item.group === 'metals' ? t.assetGroupMetals : item.group === 'currency' ? t.assetGroupCurrency : t.assetGroupStocks;
                const isSelected = selectedAsset?.key === item.key;
                return (
                  <View>
                    {showGroupHeader && (
                      <Text style={[s.groupHeader, { color: colors.mutedForeground }]}>{groupLabel}</Text>
                    )}
                    <TouchableOpacity
                      style={[s.optionRow, { borderBottomColor: colors.border }, isSelected && { backgroundColor: colors.primary + '10' }]}
                      onPress={() => { impact(); setSelectedAsset(item); setPickerOpen(false); setQuery(''); }}
                      activeOpacity={0.65}
                    >
                      <Text style={[s.optionLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                      <Text style={[s.optionPrice, { color: colors.mutedForeground }]}>
                        {item.price > 0 ? item.price.toLocaleString('en-EG', { maximumFractionDigits: 2 }) : '—'}
                      </Text>
                      {isSelected && <Feather name="check-circle" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>
        </Modal>

        {/* Delete confirm (web) */}
        <Modal visible={!!pendingDeleteId} transparent animationType="fade" onRequestClose={() => setPendingDeleteId(null)}>
          <View style={s.overlay}>
            <View style={[s.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.confirmTitle, { color: colors.text }]}>{t.deletePriceAlert}</Text>
              <Text style={[s.confirmSub, { color: colors.mutedForeground }]}>{t.deletePriceAlertConfirm}</Text>
              <View style={[s.btns, { marginTop: 16 }]}>
                <TouchableOpacity style={[s.btnCancel, { backgroundColor: colors.muted }]} onPress={() => setPendingDeleteId(null)}>
                  <Text style={[s.btnCancelText, { color: colors.text }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnSave, { backgroundColor: colors.red }]} onPress={confirmWebDelete}>
                  <Text style={[s.btnSaveText, { color: '#fff' }]}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 0 },

  empty:      { borderRadius: 18, borderWidth: 1, padding: 32, alignItems: 'center', gap: 10, marginTop: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyHint:  { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  list: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cardSub: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  cardCurrent: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12, justifyContent: 'flex-end' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },

  form:  { gap: 16, paddingTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  inputFlex: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', paddingVertical: 12 },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium', paddingLeft: 6 },

  pickerTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  pickerTriggerText: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },
  currentHint: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },

  dirRow: { flexDirection: 'row', gap: 10 },
  dirChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  dirChipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  btns:          { flexDirection: 'row', gap: 10 },
  btnCancel:     { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  btnSave:       { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnSaveText:   { fontSize: 15, fontFamily: 'Inter_600SemiBold' },

  overlay:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  confirmCard:  { width: '100%', borderRadius: 18, borderWidth: 1, padding: 22 },
  confirmTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  confirmSub:   { fontSize: 14, fontFamily: 'Inter_400Regular' },

  pickerContainer: { flex: 1 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  pickerCloseBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  groupHeader: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  optionLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  optionPrice: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
