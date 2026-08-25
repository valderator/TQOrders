import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export default function NavBar({ items, value, onChange, vertical = false }) {
  return (
    <View style={[styles.bar, vertical && styles.barVertical]}>
      {items.map(item => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [
              styles.item,
              vertical && styles.itemVertical,
              active && styles.itemActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={active ? item.icon : `${item.icon}-outline`}
              size={20}
              color={active ? colors.brand : colors.textMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  barVertical: {
    flexDirection: 'column',
    borderTopWidth: 0,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    paddingVertical: spacing.lg,
    width: 108,
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  itemVertical: { flex: undefined, paddingVertical: 12 },
  itemActive: { backgroundColor: colors.brandSoft },
  label: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  labelActive: { color: colors.brand },
});
