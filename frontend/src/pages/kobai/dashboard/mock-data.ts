export interface DailySales {
  weekdayKey:
    | 'MON'
    | 'TUE'
    | 'WED'
    | 'THU'
    | 'FRI'
    | 'SAT'
    | 'SUN';
  total: number;
  trendyol: number;
  website: number;
  whatsapp: number;
}

export interface ChannelStat {
  id: 'trendyol' | 'website' | 'whatsapp';
  label: string;
  total: number;
  share: number;
  color: string;
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  units: number;
  revenue: number;
}

export interface LowStock {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
}

export const dailySales: DailySales[] = [
  { weekdayKey: 'SUN', total: 12450, trendyol: 380, website: 2870, whatsapp: 9200 },
  { weekdayKey: 'MON', total: 38200, trendyol: 410, website: 3120, whatsapp: 34670 },
  { weekdayKey: 'TUE', total: 56700, trendyol: 620, website: 4980, whatsapp: 51100 },
  { weekdayKey: 'WED', total: 41200, trendyol: 540, website: 4250, whatsapp: 36410 },
  { weekdayKey: 'THU', total: 30800, trendyol: 770, website: 5120, whatsapp: 24910 },
  { weekdayKey: 'FRI', total: 71300, trendyol: 880, website: 6720, whatsapp: 63700 },
  { weekdayKey: 'SAT', total: 116000, trendyol: 998, website: 7875, whatsapp: 107127 },
];

export const channels: ChannelStat[] = [
  { id: 'trendyol', label: 'Trendyol', total: 4598, share: 1.4, color: '#f97316' },
  { id: 'website', label: 'Website', total: 34935, share: 11.0, color: '#6366f1' },
  { id: 'whatsapp', label: 'WhatsApp', total: 277204.98, share: 87.5, color: '#22c55e' },
];

export const topProducts: TopProduct[] = [
  { id: '1', name: 'Domates (1kg)', sku: 'TOM-1KG', units: 412, revenue: 12360 },
  { id: '2', name: 'Salça 720g', sku: 'SAL-720', units: 289, revenue: 14450 },
  { id: '3', name: 'Zeytinyağı 1L', sku: 'ZYT-1L', units: 178, revenue: 24920 },
  { id: '4', name: 'Bal 450g', sku: 'BAL-450', units: 154, revenue: 10780 },
  { id: '5', name: 'Yumurta (10\'lu)', sku: 'YMR-10', units: 142, revenue: 4260 },
];

export const lowStock: LowStock[] = [
  { id: '1', name: 'Domates (1kg)', sku: 'TOM-1KG', stock: 38, threshold: 50 },
  { id: '2', name: 'Salça 720g', sku: 'SAL-720', stock: 12, threshold: 30 },
  { id: '3', name: 'Bal 450g', sku: 'BAL-450', stock: 0, threshold: 25 },
  { id: '4', name: 'Zeytinyağı 1L', sku: 'ZYT-1L', stock: 8, threshold: 20 },
];

export const summary = {
  totalSales: 316737.98,
  netRevenue: 316737.98,
  orders: 116,
  avgBasket: 2730.5,
  returns: 0,
  cancellations: 2,
  growth: { totalSales: 790.4, orders: 480.0 },
};
