import { useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dailySales, type DailySales } from '../mock-data';
import { fmtTRY } from '../format';

type SeriesKey = 'total' | 'trendyol' | 'website' | 'whatsapp';

const SERIES: { key: SeriesKey; labelId: string; color: string }[] = [
  { key: 'total', labelId: 'DASHBOARD.CHART.ALL', color: '#3b82f6' },
  { key: 'trendyol', labelId: 'MENU.MESSAGES.WHATSAPP', color: '#f97316' },
  { key: 'website', labelId: 'MENU.MESSAGES.EMAIL', color: '#6366f1' },
  { key: 'whatsapp', labelId: 'MENU.MESSAGES.WHATSAPP', color: '#22c55e' },
];

const SERIES_TABS: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'total', label: 'Tümü / All', color: '#3b82f6' },
  { key: 'trendyol', label: 'Trendyol', color: '#f97316' },
  { key: 'website', label: 'Website', color: '#6366f1' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#22c55e' },
];

interface Props {
  weekdayLabel: (key: DailySales['weekdayKey']) => string;
}

export function SalesChart({ weekdayLabel }: Props) {
  const intl = useIntl();
  const [series, setSeries] = useState<SeriesKey>('total');

  const data = useMemo(
    () =>
      dailySales.map((d) => ({
        name: weekdayLabel(d.weekdayKey),
        value: d[series],
      })),
    [series, weekdayLabel],
  );

  const color = SERIES_TABS.find((s) => s.key === series)?.color || '#3b82f6';
  const totalLabel = intl.formatMessage({ id: 'DASHBOARD.CHART.ALL' });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          <FormattedMessage id="DASHBOARD.CHART.TITLE" />
        </CardTitle>
        <Tabs
          value={series}
          onValueChange={(v) => setSeries(v as SeriesKey)}
        >
          <TabsList>
            <TabsTrigger value="total">{totalLabel}</TabsTrigger>
            <TabsTrigger value="trendyol">Trendyol</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
                opacity={0.5}
              />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  fmtTRY(v, intl.locale).replace(/[^\d.,KMB₺$€]+/g, ' ').trim()
                }
                width={80}
              />
              <Tooltip
                formatter={(v: number) => fmtTRY(Number(v), intl.locale)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
