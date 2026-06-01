import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Button,
  ScrollView,
  Dimensions,
  TextInput,
  Image,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import {
  initDb,
  getTables,
  getOrdersForTable,
  getMenuItems,
  saveOrderForTable,
  updateOrderQuantity,
  removeOrderItem,
  closeTableById,
  clearOrdersForTable,
  clearAllTables,
  getHistory,
  addHistoryEntry,
  updateOrderNote,
  setTableNote,
  clearTableNote,
} from './db';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE = SCREEN_WIDTH < 420 ? 0.72 : 1;

const TABLE_POSITIONS = {
  1: { left: SCREEN_WIDTH * 0.06, top: 120 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
  2: { left: SCREEN_WIDTH * 0.06, top: 240 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
  3: { left: SCREEN_WIDTH * 0.18, top: 240 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
  4: { left: SCREEN_WIDTH * 0.30, top: 240 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
  5: { left: SCREEN_WIDTH * 0.42, top: 72 * SCALE, width: 240 * SCALE, height: 84 * SCALE },
  6: { left: SCREEN_WIDTH * 0.44, top: 188 * SCALE, width: 56 * SCALE, height: 44 * SCALE },
  7: { left: SCREEN_WIDTH * 0.56, top: 188 * SCALE, width: 56 * SCALE, height: 44 * SCALE },
  8: { left: SCREEN_WIDTH * 0.68, top: 188 * SCALE, width: 56 * SCALE, height: 44 * SCALE },
  9: { left: SCREEN_WIDTH * 0.80, top: 188 * SCALE, width: 56 * SCALE, height: 44 * SCALE },
  10: { left: SCREEN_WIDTH * 0.52, top: 92 * SCALE, width: 92 * SCALE, height: 92 * SCALE },
  11: { left: SCREEN_WIDTH * 0.64, top: 92 * SCALE, width: 92 * SCALE, height: 92 * SCALE },
  12: { left: SCREEN_WIDTH * 0.76, top: 92 * SCALE, width: 92 * SCALE, height: 92 * SCALE },
  13: { left: SCREEN_WIDTH * 0.88, top: 92 * SCALE, width: 92 * SCALE, height: 92 * SCALE },
  14: { left: SCREEN_WIDTH * 0.62, top: 252 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
  15: { left: SCREEN_WIDTH * 0.74, top: 252 * SCALE, width: 96 * SCALE, height: 96 * SCALE },
};

export default function App() {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeTab, setActiveTab] = useState('order');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderNote, setOrderNote] = useState('');
  const [isEditingOrderNote, setIsEditingOrderNote] = useState(false);
  const [editingOrderNoteId, setEditingOrderNoteId] = useState(null);
  const [itemNoteDraft, setItemNoteDraft] = useState('');
  const [selectedView, setSelectedView] = useState('floor');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([]);

  const categories = Array.from(new Set(menuItems.map(item => item.category))).sort();

  const handleSelectCategory = category => {
    setSelectedCategory(category);
    setSearchQuery('');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const filteredMenuItems = menuItems.filter(item => {
    const query = searchQuery.trim().toLowerCase();
    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    if (!matchesCategory) return false;
    if (!query) return true;
    return item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
  });

  useEffect(() => {
    async function load() {
      try {
        await initDb();
        const [tablesData, menuData, historyData] = await Promise.all([getTables(), getMenuItems(), getHistory()]);
        setTables(tablesData);
        setMenuItems(menuData);
        setHistoryEntries(historyData);
      } catch (error) {
        console.error('Database init failed', error);
        setError(error.message || String(error));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const formatDateTime = timestamp => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year}   ${hours}:${minutes}`;
  };

  const toggleHistoryItems = historyId => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId) ? prev.filter(id => id !== historyId) : [...prev, historyId]
    );
  };

  useEffect(() => {
    const onBackPress = () => {
      if (selectedTable) {
        setSelectedTable(null);
        return true;
      }
      if (selectedView === 'history') {
        setSelectedView('floor');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [selectedTable, selectedView]);

  const reloadTables = async () => {
    const tablesData = await getTables();
    setTables(tablesData);
  };

  const reloadHistory = async () => {
    const historyData = await getHistory();
    setHistoryEntries(historyData);
  };

  const openTable = async table => {
    setSelectedTable(table);
    setOrderNote(table.note || '');
    setIsEditingOrderNote(false);
    setEditingOrderNoteId(null);
    setItemNoteDraft('');
    setActiveTab('order');
    const ordersData = await getOrdersForTable(table.id);
    setOrders(ordersData);
  };

  const reloadOrders = async tableId => {
    const ordersData = await getOrdersForTable(tableId);
    setOrders(ordersData);
  };

  const handleAddItem = async item => {
    if (!selectedTable) return;
    await saveOrderForTable(selectedTable.id, item.id);
    await reloadOrders(selectedTable.id);
    await reloadTables();
  };

  const handleChangeQuantity = async (orderId, newQuantity) => {
    if (newQuantity <= 0) {
      await removeOrderItem(orderId);
    } else {
      await updateOrderQuantity(orderId, newQuantity);
    }
    await reloadOrders(selectedTable.id);
  };

  const handleSaveOrderNote = async () => {
    if (!selectedTable) return;
    await setTableNote(selectedTable.id, orderNote);
    setSelectedTable(prev => (prev ? { ...prev, note: orderNote } : prev));
    setIsEditingOrderNote(false);
    await reloadTables();
  };

  const handleStartEditOrderNote = () => {
    setIsEditingOrderNote(true);
    setItemNoteDraft('');
  };

  const handleCancelEditOrderNote = () => {
    setOrderNote(selectedTable?.note || '');
    setIsEditingOrderNote(false);
  };

  const startEditItemNote = item => {
    setEditingOrderNoteId(item.id);
    setItemNoteDraft(item.note || '');
  };

  const handleSaveItemNote = async item => {
    if (!selectedTable) return;
    await updateOrderNote(item.id, itemNoteDraft);
    await reloadOrders(selectedTable.id);
    setEditingOrderNoteId(null);
    setItemNoteDraft('');
  };

  const handleCancelEditItemNote = () => {
    setEditingOrderNoteId(null);
    setItemNoteDraft('');
  };

  const handleCloseTable = async () => {
    if (!selectedTable) return;
    await closeTableById(selectedTable.id);
    await reloadTables();
    setSelectedTable(null);
    setOrders([]);
  };

  const handleClearAllTables = async () => {
    await clearAllTables();
    await reloadTables();
    await reloadHistory();
    setSelectedTable(null);
    setOrders([]);
    setOrderNote('');
  };

  const confirmClearAllTables = () => {
    Alert.alert(
      'Clear all tables',
      'This will remove every open order and note from all tables. Do you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, clear all', style: 'destructive', onPress: handleClearAllTables },
      ]
    );
  };

  const handleClearTableOrders = async () => {
    if (!selectedTable) return;
    await clearOrdersForTable(selectedTable.id);
    await clearTableNote(selectedTable.id);
    setOrderNote('');
    setSelectedTable(prev => (prev ? { ...prev, note: '' } : prev));
    await reloadOrders(selectedTable.id);
    await reloadTables();
  };

  const confirmClearTableOrders = () => {
    Alert.alert(
      'Clear table',
      `Clear all items and notes from ${selectedTable?.name || 'this table'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear table', style: 'destructive', onPress: handleClearTableOrders },
      ]
    );
  };

  const handleFinishTableOrder = async () => {
    if (!selectedTable) return;
    const finishedAt = new Date().toISOString();
    const orderTotal = orders.reduce((total, order) => total + order.price * order.quantity, 0);
    await addHistoryEntry({
      table_id: selectedTable.id,
      table_name: selectedTable.name,
      items: orders.map(order => ({
        id: order.id,
        name: order.name,
        price: order.price,
        quantity: order.quantity,
        note: order.note || '',
      })),
      order_note: orderNote,
      started_at: selectedTable.order_started_at || new Date().toISOString(),
      finished_at: finishedAt,
      total_price: orderTotal,
    });
    await handleClearTableOrders();
    await reloadHistory();
  };

  const confirmFinishTableOrder = () => {
    Alert.alert(
      'Finish order',
      'Finish this order and move it to history? The table will be cleared afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish order', style: 'default', onPress: handleFinishTableOrder },
      ]
    );
  };

  const orderTotal = orders.reduce((total, order) => total + order.price * order.quantity, 0);

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <StatusBar hidden={true} />
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading cafeteria database…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centered}>
          <StatusBar hidden={true} />
          <Text style={styles.errorTitle}>App error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (selectedTable) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
            <StatusBar hidden={true} />
            <View style={styles.header}>
          <TouchableOpacity style={[styles.actionButton, styles.outlineButton, styles.smallButton]} onPress={() => setSelectedTable(null)}>
            <Text style={[styles.actionButtonText, styles.outlineButtonText]}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedTable.name}</Text>
          <TouchableOpacity style={[styles.actionButton, styles.outlineButton, styles.smallButton]} onPress={confirmClearTableOrders}>
            <Text style={[styles.actionButtonText, styles.outlineButtonText]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.finishRow}>
          <View>
            <Text style={styles.summaryText}>Total</Text>
            <Text style={styles.totalAmount}>{orderTotal.toFixed(2)} lei</Text>
          </View>
          <TouchableOpacity style={[styles.actionButton, styles.primaryButton, styles.finishButton]} onPress={confirmFinishTableOrder}>
            <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Finish order</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'order' && styles.tabButtonActive]}
            onPress={() => setActiveTab('order')}
          >
            <Text style={[styles.tabText, activeTab === 'order' && styles.tabTextActive]}>Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addMenuButton}
            onPress={() => setActiveTab('menu')}
          >
            <Text style={styles.addMenuText}>+ Menu</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'order' ? (
          <>
            <Text style={styles.sectionTitle}>Order note</Text>
            {isEditingOrderNote ? (
              <>
                <TextInput
                  style={[styles.searchInput, styles.orderNoteInput]}
                  value={orderNote}
                  onChangeText={setOrderNote}
                  placeholder="Add a note for the whole order"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={2}
                />
                <View style={styles.noteActionRow}>
                  <TouchableOpacity style={styles.noteActionButton} onPress={handleSaveOrderNote}>
                    <Text style={styles.noteActionButtonText}>Save note</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.noteActionButton, styles.noteCancelButton]} onPress={handleCancelEditOrderNote}>
                    <Text style={styles.noteActionButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.orderNoteRow}>
                <Text style={styles.orderNoteText}>{orderNote || 'No order note yet.'}</Text>
                <TouchableOpacity style={styles.noteButton} onPress={handleStartEditOrderNote}>
                  <Text style={styles.noteButtonText}>{orderNote ? 'Edit note' : 'Add note'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.sectionTitle}>Order items</Text>
            {orders.length === 0 ? (
              <Text style={styles.emptyText}>No items yet. Add from the menu tab.</Text>
            ) : (
              <FlatList
                data={orders}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.orderRow}>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderName}>{item.name}</Text>
                      <Text style={styles.orderPrice}>{item.price.toFixed(2)} lei x {item.quantity}</Text>
                      {item.note ? <Text style={styles.orderItemNote}>Note: {item.note}</Text> : null}
                      {editingOrderNoteId === item.id ? (
                        <>
                          <TextInput
                            style={[styles.noteInput]}
                            value={itemNoteDraft}
                            onChangeText={setItemNoteDraft}
                            placeholder="Edit item note"
                            placeholderTextColor="#94A3B8"
                            multiline
                          />
                          <View style={styles.noteActionRow}>
                            <TouchableOpacity style={styles.noteActionButton} onPress={() => handleSaveItemNote(item)}>
                              <Text style={styles.noteActionButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.noteActionButton, styles.noteCancelButton]} onPress={handleCancelEditItemNote}>
                              <Text style={styles.noteActionButtonText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <TouchableOpacity style={styles.noteButton} onPress={() => startEditItemNote(item)}>
                          <Text style={styles.noteButtonText}>{item.note ? 'Edit note' : 'Add note'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.quantityButtons}>
                      <TouchableOpacity onPress={() => handleChangeQuantity(item.id, item.quantity - 1)} style={styles.qtyButton}>
                        <Text style={styles.qtyButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => handleChangeQuantity(item.id, item.quantity + 1)} style={styles.qtyButton}>
                        <Text style={styles.qtyButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Menu</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, styles.searchInputWithButton]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={selectedCategory ? "Search in category..." : "Search menu..."}
                placeholderTextColor="#94A3B8"
              />
              {searchQuery ? (
                <TouchableOpacity style={styles.searchClearButton} onPress={() => setSearchQuery('')}>
                  <Text style={styles.searchClearText}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {selectedCategory ? (
              <>
                <View style={styles.categoryHeader}>
                  <TouchableOpacity style={styles.categoryBackButton} onPress={handleBackToCategories}>
                    <Text style={styles.categoryBackText}>← Categories</Text>
                  </TouchableOpacity>
                  <Text style={styles.categoryTitle}>{selectedCategory}</Text>
                </View>
                <ScrollView style={styles.menuList}>
                  {filteredMenuItems.length === 0 ? (
                    <Text style={styles.emptyText}>No items match your search.</Text>
                  ) : (
                    filteredMenuItems.map(item => (
                      <View key={item.id} style={styles.menuRow}>
                        <View>
                          <Text style={styles.menuName}>{item.name}</Text>
                          <Text style={styles.menuCategory}>{item.category}</Text>
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={() => handleAddItem(item)}>
                          <Text style={styles.addButtonText}>Add {item.price.toFixed(2)} lei</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                {searchQuery.trim() === '' ? (
                  <View style={styles.categoriesList}>
                    {categories.map(category => (
                      <TouchableOpacity
                        key={category}
                        style={styles.categoryButton}
                        onPress={() => handleSelectCategory(category)}
                      >
                        <Text style={styles.categoryButtonText}>{category}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <ScrollView style={styles.menuList}>
                    {filteredMenuItems.length === 0 ? (
                      <Text style={styles.emptyText}>No menu items match your search.</Text>
                    ) : (
                      filteredMenuItems.map(item => (
                        <View key={item.id} style={styles.menuRow}>
                          <View>
                            <Text style={styles.menuName}>{item.name}</Text>
                            <Text style={styles.menuCategory}>{item.category}</Text>
                          </View>
                          <TouchableOpacity style={styles.addButton} onPress={() => handleAddItem(item)}>
                            <Text style={styles.addButtonText}>Add {item.price.toFixed(2)} lei</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </ScrollView>
                )}
              </>
            )}
          </>
        )}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const visibleTables = tables;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.homeHeader}>
          <View style={styles.brandRow}>
            <Image source={require('./assets/turquoise-logo.png')} style={styles.logo} />
            <View>
              <Text style={styles.title}>Turquoise</Text>
              <Text style={styles.subtitle}>Bakery & Brunch</Text>
            </View>
          </View>
          <View style={styles.homeButtonRow}>
            <TouchableOpacity
              style={[styles.actionButton, selectedView !== 'history' ? styles.primaryButton : styles.secondaryButton]}
              onPress={() => setSelectedView(prev => (prev === 'history' ? 'floor' : 'history'))}
            >
              <Text style={[styles.actionButtonText, selectedView !== 'history' ? styles.primaryButtonText : styles.secondaryButtonText]}>
                {selectedView === 'history' ? 'Back to floor' : 'View history'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.outlineButton]} onPress={confirmClearAllTables}>
              <Text style={[styles.actionButtonText, styles.outlineButtonText]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        </View>

        {selectedView === 'history' ? (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Order History</Text>
            {historyEntries.length === 0 ? (
              <Text style={styles.emptyText}>No history yet.</Text>
            ) : (
              <FlatList
                data={historyEntries.slice().reverse()}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.historyRow}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyTitle}>{item.table_name}</Text>
                    </View>
                    <Text style={styles.historyMeta}>Started at: {formatDateTime(item.started_at)}</Text>
                    <Text style={styles.historyMeta}>Finished at: {formatDateTime(item.finished_at)}</Text>
                    <Text style={styles.historyMeta}>Total: {Number(item.total_price || 0).toFixed(2)} lei</Text>
                    {item.order_note ? <Text style={styles.historyNote}>Order note: {item.order_note}</Text> : null}
                    <TouchableOpacity style={styles.historyToggleRow} onPress={() => toggleHistoryItems(item.id)}>
                      <Text style={styles.historyToggleText}>
                        {expandedHistoryIds.includes(item.id)
                          ? `Hide ${item.items.length} item${item.items.length === 1 ? '' : 's'}`
                          : `Show ${item.items.length} item${item.items.length === 1 ? '' : 's'}`}
                      </Text>
                      <Text style={styles.historyToggleIcon}>
                        {expandedHistoryIds.includes(item.id) ? '▲' : '▼'}
                      </Text>
                    </TouchableOpacity>
                    {expandedHistoryIds.includes(item.id) ? (
                      <View style={styles.historyItemsContainer}>
                        {item.items.map(sub => (
                          <View key={`${item.id}-${sub.id}`} style={styles.historyItemRow}>
                            <View style={styles.historyItemLabelRow}>
                              <Text style={styles.historyItemTitle}>{sub.quantity}x {sub.name}</Text>
                              <Text style={styles.historyItemPrice}>{(sub.price * sub.quantity).toFixed(2)} lei</Text>
                            </View>
                            {sub.note ? <Text style={styles.historyItemNote}>Note: {sub.note}</Text> : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              />
            )}
          </View>
        ) : (
          <View style={styles.floorPlan}>
          {visibleTables.map(table => {
            const pos = TABLE_POSITIONS[table.id] || { left: 0, top: 0, width: 96 * SCALE, height: 96 * SCALE };
            const sizeStyle = {
              width: pos.width || 96 * SCALE,
              height: pos.height || 96 * SCALE,
            };
            const bgStyles = [
              styles.tableAbsoluteButton,
              table.status === 'closed' && styles.tableClosed,
              { left: pos.left, top: pos.top },
              sizeStyle,
            ];
            return (
              <TouchableOpacity
                key={table.id}
                style={bgStyles}
                onPress={() => openTable(table)}
              >
                <Text style={[styles.tableFloorLabel, { fontSize: 16 * SCALE }]}>{table.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#86198F',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  homeHeader: {
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  homeButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  actionButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    marginRight: 12,
  },
  actionButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#0F172A',
  },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  outlineButtonText: {
    color: '#0F172A',
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  finishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  tableActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  logo: {
    width: 64,
    height: 64,
    marginRight: 12,
    borderRadius: 18,
    backgroundColor: '#10B981',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginTop: 4,
  },
  historyContainer: {
    flex: 1,
  },
  historyRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#00000010',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyTime: {
    color: '#6B7280',
  },
  historyMeta: {
    color: '#475569',
    marginBottom: 8,
  },
  historyNote: {
    color: '#475569',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  historyItemsContainer: {
    marginTop: 10,
  },
  historyItemRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyItemLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyItemTitle: {
    color: '#0F172A',
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  historyItemPrice: {
    color: '#2563EB',
    fontWeight: '700',
  },
  historyItemNote: {
    color: '#475569',
    fontSize: 13,
  },
  historyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginTop: 12,
  },
  historyToggleText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  historyToggleIcon: {
    color: '#2563EB',
    fontWeight: '700',
  },
  historyItem: {
    color: '#0F172A',
    marginBottom: 4,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#00000020',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  tableName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  tableStatus: {
    marginTop: 4,
    color: '#2563EB',
    fontWeight: '600',
  },
  openText: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 12,
    color: '#0F172A',
  },
  emptyText: {
    color: '#475569',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 18,
  },
  floorPlan: {
    flex: 1,
    position: 'relative',
  },
  floorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 18,
  },
  tableFloorButton: {
    backgroundColor: '#E0F2FE',
    width: '40%',
    aspectRatio: 1,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    shadowColor: '#00000020',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tableFloorLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  tableFloorStatus: {
    marginTop: 6,
    color: '#2563EB',
    fontWeight: '600',
  },
  tableClosed: {
    backgroundColor: '#FEE2E2',
  },
  tableAbsoluteButton: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    padding: 14,
    shadowColor: '#00000020',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  addMenuButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#10B981',
  },
  addMenuText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  orderRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#00000010',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderItemNote: {
    marginTop: 8,
    color: '#475569',
    fontStyle: 'italic',
  },
  orderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  orderPrice: {
    marginTop: 4,
    color: '#475569',
  },
  quantityButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  qtyText: {
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  menuList: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A',
  },
  searchRow: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInputWithButton: {
    paddingRight: 42,
  },
  searchClearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    color: '#475569',
    fontSize: 18,
    lineHeight: 20,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  orderNoteInput: {
    minHeight: 54,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  noteSaveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  noteSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  orderItemNote: {
    marginTop: 8,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  orderNoteRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderNoteText: {
    color: '#475569',
    marginBottom: 8,
  },
  orderNoteInput: {
    minHeight: 44,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  noteButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  noteButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  noteActionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  noteActionButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#2563EB',
    marginRight: 10,
  },
  noteCancelButton: {
    backgroundColor: '#9CA3AF',
  },
  noteActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoriesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    width: '48%',
    alignItems: 'center',
  },
  categoryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBackButton: {
    marginRight: 12,
  },
  categoryBackText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  menuCategory: {
    marginTop: 4,
    color: '#6B7280',
  },
  addButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summary: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  summaryText: {
    color: '#0C4A6E',
    fontWeight: '600',
    marginBottom: 4,
  },
});
