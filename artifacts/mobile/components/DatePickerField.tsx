import React, { createElement, useState } from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

interface Props {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  onClear?: () => void;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
}

function isoToDate(iso: string): Date {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDisplay(iso: string): string {
  const d = isoToDate(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function DatePickerField({ label, value, onChange, onClear, placeholder, maxDate, minDate }: Props) {
  const colors = useColors();
  const t = useT();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(isoToDate(value));

  const isEmpty = !value;

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selected) onChange(selected.toISOString().split('T')[0]);
    } else {
      if (selected) setTempDate(selected);
    }
  };

  const confirmIOS = () => {
    onChange(tempDate.toISOString().split('T')[0]);
    setShowPicker(false);
  };

  const openPicker = () => {
    setTempDate(isoToDate(value));
    setShowPicker(true);
  };

  const maxIso = maxDate?.toISOString().split('T')[0];
  const minIso = minDate?.toISOString().split('T')[0];

  /* ── Web: transparent native <input type="date"> overlaid on the button ── */
  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[st.field, { borderColor: colors.border, backgroundColor: colors.card, position: 'relative', overflow: 'hidden' }]}>
          <Feather name="calendar" size={16} color={isEmpty ? colors.mutedForeground : colors.primary} />
          <Text style={[st.value, { color: isEmpty ? colors.mutedForeground : colors.text }]}>
            {isEmpty ? (placeholder ?? '') : formatDisplay(value)}
          </Text>
          {onClear && !isEmpty ? (
            <TouchableOpacity onPress={onClear} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : (
            <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
          )}
          {createElement('input', {
            type: 'date',
            value,
            ...(maxIso ? { max: maxIso } : {}),
            ...(minIso ? { min: minIso } : {}),
            onChange: (e: any) => onChange(e.target.value),
            style: {
              position: 'absolute',
              inset: 0,
              opacity: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              border: 'none',
            },
          })}
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={[st.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.75}
        style={[st.field, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <Feather name="calendar" size={16} color={isEmpty ? colors.mutedForeground : colors.primary} />
        <Text style={[st.value, { color: isEmpty ? colors.mutedForeground : colors.text }]}>
          {isEmpty ? (placeholder ?? '') : formatDisplay(value)}
        </Text>
        {onClear && !isEmpty ? (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>

      {/* Android — opens inline dialog, no modal needed */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={isoToDate(value)}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
      )}

      {/* iOS — modal bottom sheet */}
      {Platform.OS === 'ios' && (
        <Modal
          transparent
          visible={showPicker}
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable style={st.overlay} onPress={() => setShowPicker(false)} />
          <View style={[st.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={[st.sheetHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={[st.cancel, { color: colors.mutedForeground }]}>{t.cancelBtn}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmIOS}>
                <Text style={[st.done, { color: colors.primary }]}>{t.datePickerDone}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={handleChange}
              maximumDate={maxDate}
              minimumDate={minDate}
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  label:  { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  field:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  value:  { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:  { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  cancel: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  done:   { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
