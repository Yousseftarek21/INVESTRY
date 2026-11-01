import React, { useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useCash } from '@/context/CashContext';
import { backChevron } from '@/utils/rtl';
import { useMarketPrices } from '@/hooks/usePrices';
import { convert } from '@/utils/rentalMath';
import type { BookingPlatform, RentalExpenseCategory, RentalMode, RentalPaymentMethod } from '@/types';

export const RENTAL_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];
export const PAYMENT_METHODS: RentalPaymentMethod[] = ['cash', 'bank_transfer', 'instapay', 'vodafone_cash', 'other'];
export const PLATFORMS: BookingPlatform[] = ['airbnb', 'booking_com', 'direct', 'other'];
export const EXPENSE_CATEGORIES: RentalExpenseCategory[] = [
  'cleaning', 'maintenance', 'utilities', 'internet', 'building_fees',
  'furnishing', 'management', 'taxes', 'supplies', 'other',
];

type T = ReturnType<typeof useT>;

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function fmtMoney(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString('en-EG')} ${currency}`;
}

export function useDateFormat() {
  const { language } = useAppSettings();
  const locale = language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const at = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return {
    day: (iso: string) => at(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    full: (iso: string) => at(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    month: (ym: string) => at(`${ym}-15`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    monthShort: (ym: string) => at(`${ym}-15`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
    weekdayInitials: () => {
      // 2023-01-01 was a Sunday; Egypt's week view starts on Saturday.
      return [6, 0, 1, 2, 3, 4, 5].map(i =>
        at(`2023-01-0${i + 1}`).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' }));
    },
  };
}

export function modeLabel(m: RentalMode, t: T): string {
  return m === 'short_stay' ? t.rpModeShortStay : m === 'long_term' ? t.rpModeLongTerm : t.rpModeBoth;
}

export function platformLabel(p: BookingPlatform, t: T, other?: string): string {
  if (p === 'airbnb') return t.channelAirbnb;
  if (p === 'booking_com') return t.channelBookingCom;
  if (p === 'direct') return t.rpPlatformDirect;
  return other || t.channelOther;
}

export function paymentMethodLabel(m: RentalPaymentMethod, t: T): string {
  if (m === 'cash') return t.paymentMethodCash;
  if (m === 'bank_transfer') return t.paymentMethodBankTransfer;
  if (m === 'instapay') return t.paymentMethodInstapay;
  if (m === 'vodafone_cash') return t.paymentMethodVodafoneCash;
  return t.channelOther;
}

export function categoryLabel(c: RentalExpenseCategory, t: T): string {
  const map: Record<RentalExpenseCategory, string> = {
    cleaning: t.rpCatCleaning, maintenance: t.rpCatMaintenance, utilities: t.rpCatUtilities,
    internet: t.rpCatInternet, building_fees: t.rpCatBuildingFees, furnishing: t.rpCatFurnishing,
    management: t.rpCatManagement, taxes: t.rpCatTaxes, supplies: t.rpCatSupplies, other: t.rpCatOther,
  };
  return map[c];
}

export const CATEGORY_ICONS: Record<RentalExpenseCategory, keyof typeof Feather.glyphMap> = {
  cleaning: 'wind', maintenance: 'tool', utilities: 'zap', internet: 'wifi', building_fees: 'home',
  furnishing: 'package', management: 'briefcase', taxes: 'file-text', supplies: 'shopping-bag', other: 'more-horizontal',
};

// ── Layout pieces ─────────────────────────────────────────────────────────────

export function ScreenHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  return (
    <View style={[rs.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={onBack ?? (() => router.back())} hitSlop={10} accessibilityRole="button">
        <Feather name={backChevron()} size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={[rs.headerTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 22, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const colors = useColors();
  return (
    <View style={rs.field}>
      <Text style={[rs.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
      {hint ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function ChipRow<V extends string>({ options, value, onChange, label }: {
  options: V[];
  value: V | undefined;
  onChange: (v: V) => void;
  label: (v: V) => string;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rs.chips} keyboardShouldPersistTaps="handled">
      {options.map(o => {
        const on = value === o;
        return (
          <TouchableOpacity
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[rs.chip, { backgroundColor: on ? colors.primary : colors.input, borderColor: on ? colors.primary : colors.border }]}
          >
            <Text style={[rs.chipText, { color: on ? colors.primaryForeground : colors.text }]}>{label(o)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <View style={[rs.toggleRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[rs.toggleLabel, { color: colors.text }]}>{label}</Text>
        {desc ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

/** Pick a cash account to deposit received money into, once. */
export function AccountPickerField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const colors = useColors();
  const t = useT();
  const { cashAccounts } = useCash();
  const [open, setOpen] = useState(false);
  const selected = cashAccounts.find(a => a.id === value);
  return (
    <Field label={t.depositIntoOptional}>
      {cashAccounts.length === 0 ? (
        <View style={[rs.input, rs.rowCenter, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
          <Text style={[rs.hint, { color: colors.mutedForeground, flex: 1 }]}>{t.noCashAccounts}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[rs.input, rs.rowBetween, { backgroundColor: colors.input, borderColor: colors.border }]}
          onPress={() => setOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={[rs.inputText, { color: value ? colors.text : colors.mutedForeground }]} numberOfLines={1}>
            {selected ? `${selected.accountName} · ${selected.currency}` : t.dontAddToCash}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={rs.sheetOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[rs.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[rs.sheetTitle, { color: colors.text }]}>{t.depositIntoOptional}</Text>
            {[{ id: '', accountName: t.dontAddToCash, currency: '' }, ...cashAccounts].map(a => (
              <TouchableOpacity
                key={a.id || 'none'}
                style={[rs.sheetOption, { borderColor: colors.border, backgroundColor: value === a.id ? colors.primary + '14' : 'transparent' }]}
                onPress={() => { onChange(a.id); setOpen(false); }}
              >
                <Text style={[rs.inputText, { color: value === a.id ? colors.primary : colors.text }]}>{a.accountName}</Text>
                {a.currency ? <Text style={[rs.hint, { color: colors.mutedForeground }]}>{a.currency}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </Field>
  );
}

/**
 * Adds received rental money to a cash account once, converted into the
 * account's own currency (the old rental screen added the raw number, so
 * 500 USD landed in an EGP account as 500 EGP).
 */
export function useDepositToCash() {
  const { cashAccounts, updateCashAccount } = useCash();
  const { data: prices } = useMarketPrices();
  return (accountId: string | undefined, amount: number, currency: string) => {
    if (!accountId || !(amount > 0)) return;
    const account = cashAccounts.find(a => a.id === accountId);
    if (!account) return;
    const add = convert(amount, currency, account.currency || 'EGP', prices);
    updateCashAccount({ ...account, balance: (Number(account.balance) || 0) + Math.round(add * 100) / 100 }).catch(() => null);
  };
}

export function SaveBar({ onSave, saving, label }: { onSave: () => void; saving?: boolean; label?: string }) {
  const colors = useColors();
  const t = useT();
  return (
    <View style={rs.btns}>
      <TouchableOpacity style={[rs.btnCancel, { backgroundColor: colors.muted }]} onPress={() => router.back()} activeOpacity={0.8}>
        <Text style={[rs.btnText, { color: colors.text }]}>{t.cancel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[rs.btnSave, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        <Text style={[rs.btnText, { color: colors.primaryForeground }]}>{label ?? t.save}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Confirm, delete, then close the form. */
export function DeleteButton({ onDelete, message }: { onDelete: () => Promise<void>; message?: string }) {
  const colors = useColors();
  const t = useT();
  const confirm = () => {
    Alert.alert(t.delete, message ?? t.rpDeleteEntryConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          try { await onDelete(); router.back(); } catch { Alert.alert(t.couldNotSave, t.rpSaveFailed); }
        },
      },
    ]);
  };
  return (
    <TouchableOpacity onPress={confirm} style={[rs.btnDelete, { borderColor: colors.red + '40' }]} activeOpacity={0.8} accessibilityRole="button">
      <Feather name="trash-2" size={15} color={colors.red} />
      <Text style={[rs.btnText, { color: colors.red }]}>{t.delete}</Text>
    </TouchableOpacity>
  );
}

export const rs = StyleSheet.create({
  btnDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 13 },
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', flex: 1, textAlign: 'center' },
  content: { padding: 16, gap: 16 },
  form: { padding: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  hint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  inputText: { fontSize: 15, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.4, textTransform: 'uppercase' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnSave: { flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, paddingBottom: 36, gap: 6 },
  sheetTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
});
