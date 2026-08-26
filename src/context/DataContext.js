import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import * as api from '../data/api';
import { getSyncState, getVersion, startSyncLoop, stopSyncLoop, subscribe, sync } from '../data/store';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  useEffect(() => {
    api.ensureSeed();
  }, []);

  useEffect(() => {
    if (!user) {
      stopSyncLoop();
      return undefined;
    }
    startSyncLoop();
    return () => stopSyncLoop();
  }, [user]);

  const value = useMemo(() => {
    const floors = api.getFloors();
    const tables = api.getTables();
    const menuItems = api.getMenuItems();
    const history = api.getHistory();
    const shifts = api.getShifts();
    const profiles = api.getProfiles();
    return {
      version,
      floors,
      tables,
      menuItems,
      categories: api.getMenuCategories(),
      categoryRecords: api.getCategoryRecords(),
      history,
      historyByDay: api.groupHistoryByDay(history),
      shifts,
      profiles,
      openOrders: api.getOpenOrders(),
      occupancy: api.getOccupancyMap(),
      syncState: getSyncState(),
      refresh: () => sync({ force: true }),
      api,
    };
  }, [version]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
