import { SAMPLE_MENU } from '../../data/menu';

/**
 * Floor plans are stored as fractions (0..1) of a fixed-aspect canvas so the
 * same layout scales from a phone browser to a desktop screen.
 */
export const FLOOR_ASPECT = 420 / 760;

const W = 150 / 420;
const H = 80 / 760;

export const DEFAULT_FLOORS = [
  { id: 'floor-salon', name: 'Salon', sort_order: 0 },
  { id: 'floor-terasa', name: 'Terasa', sort_order: 1 },
];

const SALON = [
  ['M1', 0.63, 0.0, W, H],
  ['M2', 0.27, 0.0, W, H],
  ['M3', 0.02, 90 / 760, W, H],
  ['M4', 0.02, 190 / 760, W, H],
  ['BAR', 0.5, 200 / 760, W, 250 / 760],
  ['M5', 0.02, 350 / 760, W, H],
  ['M6', 0.02, 450 / 760, W, H],
  ['M7', 0.02, 550 / 760, W, H],
  ['M8', 0.02, 650 / 760, W, H],
  ['M9', 0.5, 550 / 760, W, H],
  ['M10', 0.5, 650 / 760, W, H],
];

const TERASA = Array.from({ length: 7 }, (_, index) => [
  `T${index + 1}`,
  0.25,
  (10 + index * 100) / 760,
  210 / 420,
  90 / 760,
]);

export const DEFAULT_TABLES = [
  ...SALON.map(([name, x, y, w, h], index) => ({
    id: `table-salon-${index + 1}`,
    name,
    floor_id: 'floor-salon',
    x,
    y,
    w,
    h,
    seats: name === 'BAR' ? 8 : 4,
    sort_order: index,
  })),
  ...TERASA.map(([name, x, y, w, h], index) => ({
    id: `table-terasa-${index + 1}`,
    name,
    floor_id: 'floor-terasa',
    x,
    y,
    w,
    h,
    seats: 4,
    sort_order: index,
  })),
];

export const DEFAULT_MENU_ITEMS = SAMPLE_MENU.map((item, index) => ({
  id: `menu-${index + 1}`,
  name: item.name,
  price: item.price,
  category: item.category,
  available: true,
  sort_order: index,
}));

export const DEFAULT_LOCAL_USERS = [
  {
    id: 'local-admin',
    email: 'admin@local',
    full_name: 'Local Admin',
    role: 'admin',
    active: true,
    pin: '1234',
  },
  {
    id: 'local-staff',
    email: 'staff@local',
    full_name: 'Local Waiter',
    role: 'employee',
    active: true,
    pin: '1111',
  },
];
