import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from './components/AppHeader';
import NavBar from './components/NavBar';
import LoginScreen from './screens/LoginScreen';
import FloorScreen from './screens/FloorScreen';
import TableScreen from './screens/TableScreen';
import HistoryScreen from './screens/HistoryScreen';
import CalendarScreen from './screens/CalendarScreen';
import ManageScreen from './screens/ManageScreen';
import AccountScreen from './screens/AccountScreen';
import { useAuth } from './context/AuthContext';
import { useLayoutInfo } from './hooks/useLayoutInfo';
import { colors, spacing, typography } from './theme';

const BASE_TABS = [
  { key: 'floor', label: 'Floor', icon: 'grid', title: 'Floor plan' },
  { key: 'history', label: 'History', icon: 'time', title: 'Order history' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', title: 'Work calendar' },
  { key: 'account', label: 'Me', icon: 'person', title: 'My account' },
];

const ADMIN_TAB = { key: 'manage', label: 'Manage', icon: 'settings', title: 'Management' };

export default function AppShell() {
  const { user, initializing, isAdmin } = useAuth();
  const { isWide } = useLayoutInfo();
  const [tab, setTab] = useState('floor');
  const [openTable, setOpenTable] = useState(null);

  const tabs = isAdmin ? [...BASE_TABS.slice(0, 3), ADMIN_TAB, BASE_TABS[3]] : BASE_TABS;

  useEffect(() => {
    const onBack = () => {
      if (openTable) {
        setOpenTable(null);
        return true;
      }
      if (tab !== 'floor') {
        setTab('floor');
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [openTable, tab]);

  if (initializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={typography.muted}>Loading Turquoise…</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (openTable) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
        <TableScreen table={openTable} onClose={() => setOpenTable(null)} />
      </SafeAreaView>
    );
  }

  const active = tabs.find(item => item.key === tab) || tabs[0];

  const content = (
    <>
      {tab === 'floor' ? <FloorScreen onOpenTable={setOpenTable} /> : null}
      {tab === 'history' ? <HistoryScreen /> : null}
      {tab === 'calendar' ? <CalendarScreen /> : null}
      {tab === 'manage' ? <ManageScreen /> : null}
      {tab === 'account' ? <AccountScreen /> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
      {isWide ? (
        <View style={styles.wide}>
          <NavBar items={tabs} value={tab} onChange={setTab} vertical />
          <View style={{ flex: 1 }}>
            <AppHeader title={active.title} />
            {content}
          </View>
        </View>
      ) : (
        <>
          <AppHeader title={active.title} />
          <View style={{ flex: 1 }}>{content}</View>
          <NavBar items={tabs} value={tab} onChange={setTab} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  wide: { flex: 1, flexDirection: 'row' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
});
