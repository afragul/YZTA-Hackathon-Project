import { useState } from 'react';
import {
  BarChart3,
  Calendar,
  RotateCcw,
  ShoppingCart,
  Wallet,
  XCircle,
} from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Container } from '@/components/common/container';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChannelsCard } from './components/channels-card';
import { KpiCard } from './components/kpi-card';
import { LowStockCard } from './components/low-stock-card';
import { SalesChart } from './components/sales-chart';
import { TopProductsCard } from './components/top-products-card';
import { fmtNumber, fmtTRY } from './format';
import { summary, type DailySales } from './mock-data';

const RANGE_OPTIONS = [
  { value: '7', labelId: 'DASHBOARD.RANGE.7', days: 7 },
  { value: '14', labelId: 'DASHBOARD.RANGE.14', days: 14 },
  { value: '30', labelId: 'DASHBOARD.RANGE.30', days: 30 },
] as const;

export function DashboardPage() {
  const intl = useIntl();
  const [range, setRange] = useState<'7' | '14' | '30'>('7');
  const days = RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 7;

  const weekdayLabel = (key: DailySales['weekdayKey']) =>
    intl.formatMessage({ id: `DASHBOARD.WEEKDAYS.${key}` });

  const vsPrev = intl.formatMessage(
    { id: 'DASHBOARD.KPI.VS_PREVIOUS' },
    { days },
  );

  return (
    <>
      <Container>
        <div className="mb-5 flex items-end justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              <FormattedMessage id="DASHBOARD.HEADER.SUBTITLE" />
            </p>
          </div>
          <Tabs
            value={range}
            onValueChange={(v) => setRange(v as '7' | '14' | '30')}
          >
            <TabsList>
              {RANGE_OPTIONS.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  <FormattedMessage id={r.labelId} />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </Container>

      <Container className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.TOTAL_SALES" />}
            value={fmtTRY(summary.totalSales, intl.locale)}
            trend={summary.growth.totalSales}
            hint={vsPrev}
            icon={<Wallet className="size-4" />}
          />
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.NET_REVENUE" />}
            value={fmtTRY(summary.netRevenue, intl.locale)}
            trend={summary.growth.totalSales}
            hint={vsPrev}
            icon={<Calendar className="size-4" />}
          />
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.ORDERS" />}
            value={fmtNumber(summary.orders, intl.locale)}
            trend={summary.growth.orders}
            hint={vsPrev}
            icon={<ShoppingCart className="size-4" />}
          />
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.AVG_BASKET" />}
            value={fmtTRY(summary.avgBasket, intl.locale)}
            trend={0}
            hint={vsPrev}
            icon={<BarChart3 className="size-4" />}
          />
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.RETURNS" />}
            value={fmtTRY(summary.returns, intl.locale)}
            trend={0}
            hint={
              <FormattedMessage
                id="DASHBOARD.KPI.RETURN_RATE"
                values={{ rate: 0 }}
              />
            }
            icon={<RotateCcw className="size-4" />}
          />
          <KpiCard
            label={<FormattedMessage id="DASHBOARD.KPI.CANCELLATIONS" />}
            value={fmtNumber(summary.cancellations, intl.locale)}
            trend={0}
            hint={vsPrev}
            icon={<XCircle className="size-4" />}
          />
        </div>

        <SalesChart weekdayLabel={weekdayLabel} />

        <ChannelsCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TopProductsCard />
          <LowStockCard />
        </div>
      </Container>
    </>
  );
}
