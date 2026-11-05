import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useHaptic } from '@/hooks/useHaptic';
import { useHoldings } from '@/context/HoldingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useRentalProperties } from '@/context/RentalPropertiesContext';
import { AmountInput } from '@/components/AmountInput';
import { parseAmount } from '@/utils/parseAmount';
import type { PropertyType, RealEstateHolding, RentalMode, RentalUnit } from '@/types';
import { ChipRow, Field, RENTAL_CURRENCIES, SaveBar, ScreenHeader, generateId, modeLabel, rs } from '@/components/rental/RentalUI';

const MODES: RentalMode[] = ['short_stay', 'long_term', 'both'];
const UNIT_TYPES: PropertyType[] = ['apartment', 'chalet', 'villa', 'duplex', 'penthouse', 'townhouse', 'office', 'retail_shop'];

export default function RentalUnitFormScreen() {
  const colors = useColors();
  const t = useT();
  const { notify } = useHaptic();
  const insets = useSafeAreaInsets();
  const { unitId } = useLocalSearchParams<{ unitId?: string }>();
  const { units, add, update } = useRentalProperties();
  const { holdings } = useHoldings();
  const { featuresUnlocked, isLoading: subLoading, showPaywallFromModal } = useSubscription();
  const existing = unitId ? units.find(u => u.id === unitId) : undefined;

  const typeLabel: Record<PropertyType, string> = {
    apartment: t.apartment, villa: t.villa, duplex: t.duplex, penthouse: t.penthouse, townhouse: t.townhouse,
    chalet: t.chalet, land: t.land, office: t.office, retail_shop: t.retailShop, commercial: t.commercial,
    medical_clinic: t.medicalClinic, warehouse: t.warehouse,
  };
  const realEstate = useMemo(() => holdings.filter((h): h is RealEstateHolding => h.type === 'real_estate'), [holdings]);

  const [name, setName] = useState(existing?.name ?? '');
  const [mode, setMode] = useState<RentalMode>(existing?.mode ?? 'short_stay');
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>(existing?.propertyType ?? 'apartment');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [bedrooms, setBedrooms] = useState(existing?.bedrooms != null ? String(existing.bedrooms) : '');
  const [maxGuests, setMaxGuests] = useState(existing?.maxGuests != null ? String(existing.maxGuests) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? 'EGP');
  const [nightly, setNightly] = useState(existing?.defaultNightlyRate != null ? String(existing.defaultNightlyRate) : '');
  const [cleaning, setCleaning] = useState(existing?.defaultCleaningFee != null ? String(existing.defaultCleaningFee) : '');
  const [monthly, setMonthly] = useState(existing?.defaultMonthlyRent != null ? String(existing.defaultMonthlyRent) : '');
  const [holdingId, setHoldingId] = useState<string>(existing?.holdingId ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const optNum = (raw: string): number | undefined => {
    if (!raw.trim()) return undefined;
    const n = parseAmount(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const optInt = (raw: string): number | undefined => {
    const n = optNum(raw);
    return n === undefined ? undefined : Math.round(n);
  };

  const { logActivity } = useActivityLog();
  const save = async () => {
    if (!name.trim()) { Alert.alert(t.missingFields, t.rpNameRequired); return; }
    if (!existing && !subLoading && !featuresUnlocked) { showPaywallFromModal(); return; }
    const showsNightly = mode !== 'long_term';
    const showsMonthly = mode !== 'short_stay';
    const now = new Date().toISOString();
    const unit: RentalUnit = {
      ...(existing ?? { id: generateId(), createdAt: now }),
      name: name.trim(),
      mode,
      propertyType,
      location: location.trim() || undefined,
      bedrooms: optInt(bedrooms),
      maxGuests: showsNightly ? optInt(maxGuests) : undefined,
      currency,
      defaultNightlyRate: showsNightly ? optNum(nightly) : undefined,
      defaultCleaningFee: showsNightly ? optNum(cleaning) : undefined,
      defaultMonthlyRent: showsMonthly ? optNum(monthly) : undefined,
      holdingId: holdingId || undefined,
      notes: notes.trim() || undefined,
      ...(existing ? { updatedAt: now } : {}),
    };
    setSaving(true);
    try {
      if (existing) await update('units', unit);
      else {
        await add('units', unit);
        const how = unit.mode === 'short_stay' ? t.rpModeShortStay : unit.mode === 'long_term' ? t.rpModeLongTerm : t.rpModeBoth;
        void logActivity('rental_unit_added', t.actAdded(unit.name), unit.location ? `${how} · ${unit.location}` : how, unit.id);
      }
      notify();
      router.back();
      // Open the new unit once this sheet has finished closing — presenting
      // over a sheet that's still dismissing is unreliable on iOS.
      if (!existing) setTimeout(() => router.push({ pathname: '/rental-unit', params: { unitId: unit.id } } as any), 400);
    } catch {
      Alert.alert(t.couldNotSave, t.rpSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [rs.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }];
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[rs.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={existing ? t.rpEditUnit : t.rpNewUnit} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[rs.form, { paddingBottom: botPad + 32 }]} keyboardShouldPersistTaps="handled">
            <Field label={t.rpUnitName}>
              <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder={t.rpUnitNamePlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={120} />
            </Field>

            <Field label={t.rpHowYouRent}>
              <View style={{ gap: 8 }}>
                {MODES.map(m => {
                  const on = mode === m;
                  const desc = m === 'short_stay' ? t.rpModeShortStayDesc : m === 'long_term' ? t.rpModeLongTermDesc : t.rpModeBothDesc;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setMode(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[rs.input, { backgroundColor: on ? colors.primary + '14' : colors.input, borderColor: on ? colors.primary : colors.border, gap: 2 }]}
                    >
                      <Text style={[rs.inputText, { color: on ? colors.primary : colors.text }]}>{modeLabel(m, t)}</Text>
                      <Text style={[rs.hint, { color: colors.mutedForeground }]}>{desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label={t.rpPropertyType}>
              <ChipRow options={UNIT_TYPES} value={propertyType} onChange={setPropertyType} label={v => typeLabel[v]} />
            </Field>

            <Field label={t.rpLocation}>
              <TextInput style={inputStyle} value={location} onChangeText={setLocation} placeholder={t.rpLocationPlaceholder} placeholderTextColor={colors.mutedForeground} maxLength={160} />
            </Field>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={t.rpBedrooms}>
                  <AmountInput style={inputStyle} value={bedrooms} onChangeText={setBedrooms} placeholder="2" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </View>
              {mode !== 'long_term' && (
                <View style={{ flex: 1 }}>
                  <Field label={t.rpMaxGuests}>
                    <AmountInput style={inputStyle} value={maxGuests} onChangeText={setMaxGuests} placeholder="4" placeholderTextColor={colors.mutedForeground} />
                  </Field>
                </View>
              )}
            </View>

            <Field label={t.rpCurrency}>
              <ChipRow options={RENTAL_CURRENCIES} value={currency} onChange={setCurrency} label={v => v} />
            </Field>

            {mode !== 'long_term' && (
              <>
                <Field label={t.rpDefaultNightly}>
                  <AmountInput style={inputStyle} value={nightly} onChangeText={setNightly} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
                <Field label={t.rpDefaultCleaning}>
                  <AmountInput style={inputStyle} value={cleaning} onChangeText={setCleaning} placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </Field>
              </>
            )}
            {mode !== 'short_stay' && (
              <Field label={t.rpDefaultMonthly}>
                <AmountInput style={inputStyle} value={monthly} onChangeText={setMonthly} placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </Field>
            )}

            {realEstate.length > 0 && (
              <Field label={t.rpLinkInvestment} hint={t.rpLinkHint}>
                <ChipRow
                  options={['', ...realEstate.map(h => h.id)]}
                  value={holdingId}
                  onChange={setHoldingId}
                  label={v => (v ? realEstate.find(h => h.id === v)?.propertyName ?? '' : t.rpLinkNone)}
                />
              </Field>
            )}

            <Field label={t.rpNotes}>
              <TextInput style={[...inputStyle, { minHeight: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline maxLength={500} placeholderTextColor={colors.mutedForeground} />
            </Field>

            <SaveBar onSave={save} saving={saving} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
