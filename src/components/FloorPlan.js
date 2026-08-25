import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import { FLOOR_ASPECT } from '../data/seed';

function DraggableTable({ table, canvas, occupied, itemCount, editable, onPress, onMove }) {
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const editableRef = useRef(editable);
  const canvasRef = useRef(canvas);
  const tableRef = useRef(table);
  const onMoveRef = useRef(onMove);

  editableRef.current = editable;
  canvasRef.current = canvas;
  tableRef.current = table;
  onMoveRef.current = onMove;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        editableRef.current && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
      onPanResponderMove: (_evt, gesture) => {
        const next = { dx: gesture.dx, dy: gesture.dy };
        dragRef.current = next;
        setDrag(next);
      },
      onPanResponderRelease: () => {
        const moved = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        const { width, height } = canvasRef.current;
        if (!moved || !width || !height) return;
        onMoveRef.current(
          tableRef.current.id,
          tableRef.current.x + moved.dx / width,
          tableRef.current.y + moved.dy / height
        );
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDrag(null);
      },
    })
  ).current;

  const left = table.x * canvas.width + (drag?.dx || 0);
  const top = table.y * canvas.height + (drag?.dy || 0);
  const width = Math.max(56, table.w * canvas.width);
  const height = Math.max(44, table.h * canvas.height);

  return (
    <View style={[styles.tableWrap, { left, top, width, height }]} {...(editable ? responder.panHandlers : {})}>
      <Pressable
        onPress={() => onPress(table)}
        style={({ pressed }) => [
          styles.table,
          occupied && styles.tableOccupied,
          editable && styles.tableEditing,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.tableName, occupied && styles.tableNameOccupied]} numberOfLines={1}>
          {table.name}
        </Text>
        {occupied ? (
          <View style={styles.tableMetaRow}>
            <Ionicons name="restaurant-outline" size={11} color="#04262A" />
            <Text style={styles.tableMeta}>{itemCount}</Text>
          </View>
        ) : (
          <Text style={styles.tableSeats}>{table.seats || 4} seats</Text>
        )}
        {editable ? (
          <View style={styles.dragBadge}>
            <Ionicons name="move" size={11} color={colors.accent} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default function FloorPlan({ tables, occupancy = {}, editable = false, onPressTable, onMoveTable }) {
  const [box, setBox] = useState({ width: 0, height: 0 });

  const canvasWidth = Math.min(box.width, box.height * FLOOR_ASPECT) || 0;
  const canvasHeight = canvasWidth ? canvasWidth / FLOOR_ASPECT : 0;
  const canvas = { width: canvasWidth, height: canvasHeight };

  return (
    <View
      style={styles.container}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ width, height });
      }}
    >
      {canvasWidth > 0 ? (
        <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
          {tables.map(table => (
            <DraggableTable
              key={table.id}
              table={table}
              canvas={canvas}
              occupied={(occupancy[table.id] || 0) > 0}
              itemCount={occupancy[table.id] || 0}
              editable={editable}
              onPress={onPressTable}
              onMove={onMoveTable}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 320 },
  canvas: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  tableWrap: { position: 'absolute' },
  table: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...shadow.card,
  },
  tableOccupied: { backgroundColor: colors.brand, borderColor: colors.brandDark },
  tableEditing: { borderStyle: 'dashed', borderColor: colors.accent },
  tableName: { fontSize: 15, fontWeight: '800', color: colors.text },
  tableNameOccupied: { color: '#04262A' },
  tableSeats: { fontSize: 10, color: colors.textFaint },
  tableMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tableMeta: { fontSize: 11, fontWeight: '700', color: '#04262A' },
  dragBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: 2,
  },
});
