import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../theme';

export function Card({ style, children, padded = true, ...rest }) {
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]} {...rest}>
      {children}
    </View>
  );
}

const VARIANTS = {
  primary: { bg: colors.brand, fg: '#04262A', border: 'transparent' },
  accent: { bg: colors.accent, fg: '#0B1220', border: 'transparent' },
  neutral: { bg: colors.surfaceHi, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.textMuted, border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.text, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'rgba(248,113,113,0.4)' },
  success: { bg: colors.successSoft, fg: colors.success, border: 'rgba(52,211,153,0.4)' },
};

const SIZES = {
  sm: { py: 8, px: 12, font: 13, icon: 15, gap: 6 },
  md: { py: 12, px: 16, font: 14, icon: 17, gap: 8 },
  lg: { py: 15, px: 20, font: 16, icon: 19, gap: 10 },
};

export function Button({
  title,
  onPress,
  variant = 'neutral',
  size = 'md',
  icon,
  disabled,
  loading,
  full,
  style,
  textStyle,
}) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  const s = SIZES[size] || SIZES.md;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          gap: s.gap,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        },
        full && { alignSelf: 'stretch', flex: undefined },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={s.icon} color={v.fg} /> : null}
          {title ? (
            <Text style={[styles.buttonText, { color: v.fg, fontSize: s.font }, textStyle]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, variant = 'neutral', size = 38, color, style }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.48} color={color || v.fg} />
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon, style }) {
  const tones = {
    neutral: { bg: colors.surfaceHi, fg: colors.textMuted },
    brand: { bg: colors.brandSoft, fg: colors.brand },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    accent: { bg: colors.accentSoft, fg: colors.accent },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={t.fg} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {children}
      {hint ? <Text style={typography.tiny}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      style={[styles.input, props.multiline && styles.inputMultiline, style]}
      {...props}
    />
  );
}

export function SegmentedControl({ options, value, onChange, style, size = 'md' }) {
  return (
    <View style={[styles.segment, style]}>
      {options.map(opt => {
        const key = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.segmentItem,
              size === 'sm' && { paddingVertical: 6 },
              active && styles.segmentItemActive,
            ]}
          >
            {typeof opt === 'object' && opt.icon ? (
              <Ionicons name={opt.icon} size={14} color={active ? '#04262A' : colors.textMuted} />
            ) : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon = 'sparkles-outline', title, message, action }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function Sheet({ visible, onClose, title, subtitle, children, footer, maxWidth = 560 }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { maxWidth }]}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={typography.muted}>{subtitle}</Text> : null}
            </View>
            <IconButton icon="close" variant="ghost" onPress={onClose} color={colors.textMuted} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>{children}</ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmDialog({ state, onCancel }) {
  const { visible, title, message, confirmText, cancelText, onConfirm, tone } = state || {};
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.dialog}>
          <View style={[styles.dialogIcon, tone === 'danger' && { backgroundColor: colors.dangerSoft }]}>
            <Ionicons
              name={tone === 'danger' ? 'alert-circle-outline' : 'help-circle-outline'}
              size={24}
              color={tone === 'danger' ? colors.danger : colors.brand}
            />
          </View>
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <View style={styles.dialogRow}>
            <Button title={cancelText || 'Cancel'} variant="outline" onPress={onCancel} style={{ flex: 1 }} />
            <Button
              title={confirmText || 'Confirm'}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function StatTile({ label, value, sub, icon, tone = 'brand' }) {
  const tones = {
    brand: colors.brand,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  };
  return (
    <Card style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={styles.statLabel}>{label}</Text>
        {icon ? <Ionicons name={icon} size={16} color={tones[tone]} /> : null}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={typography.tiny}>{sub}</Text> : null}
    </Card>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  cardPadded: { padding: spacing.lg },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonText: { fontWeight: '700' },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    ...(typeof document !== 'undefined' ? { outlineStyle: 'none' } : null),
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  segmentItemActive: { backgroundColor: colors.brand },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  segmentTextActive: { color: '#04262A' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, gap: 10 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyMessage: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.float,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...shadow.float,
  },
  dialogIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  dialogMessage: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  dialogRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.xs },
  stat: { flex: 1, minWidth: 140, padding: spacing.lg, gap: 4 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.borderSoft },
});
