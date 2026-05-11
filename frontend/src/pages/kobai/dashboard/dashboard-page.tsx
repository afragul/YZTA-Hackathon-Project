import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  ShoppingCart,
  Truck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { useState } from 'react';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiRequest } from '@/lib/api-client';
import { DelayedShipmentsModal } from './delayed-shipments-modal';

interface DashboardStats {
  kpi: {
    total_sales: number;
    total_orders: number;
    avg_basket: number;
    cancellations: number;
    pending_orders: number;
    shipped_orders: number;
    delivered_orders: number;
    customers: number;
    products: number;
  };
  shipments: {
    total: number;
    delayed: number;
    in_transit: number;
    delivered: number;
  };
  tasks: {
    total: number;
    todo: number;
    in_progress: number;
  };
  unread_notifications: number;
  top_products: Array<{
    id: number;
    name: string;
    sku: string;
    units: number;
    revenue: number;
  }>;
  low_stock: Array<{
    id: number;
    name: string;
    sku: string;
    stock: number;
    threshold: number;
  }>;
}

function fmtTRY(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiRequest<DashboardStats>('/dashboard/stats'),
    staleTime: 30_000,
  });

  const [delayedModalOpen, setDelayedModalOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <Container className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </Container>
    );
  }

  const { kpi, shipments, tasks, unread_notifications, top_products, low_stock } = data;

  return (
    <>
    <Container className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-mono">
          <FormattedMessage id="DASHBOARD.HEADER.TITLE" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Anadolu Doğal Organik Gıda Kooperatifi — Genel Bakış
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Wallet className="size-4" />}
          label="Toplam Satış"
          value={fmtTRY(kpi.total_sales)}
          color="text-emerald-600 bg-emerald-50"
        />
        <KpiCard
          icon={<ShoppingCart className="size-4" />}
          label="Sipariş Sayısı"
          value={String(kpi.total_orders)}
          color="text-blue-600 bg-blue-50"
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Ortalama Sepet"
          value={fmtTRY(kpi.avg_basket)}
          color="text-violet-600 bg-violet-50"
        />
        <KpiCard
          icon={<Users className="size-4" />}
          label="Müşteriler"
          value={String(kpi.customers)}
          color="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={<Clock className="size-4" />}
          label="Bekleyen Siparişler"
          value={kpi.pending_orders}
          variant="warning"
        />
        <StatusCard
          icon={<Truck className="size-4" />}
          label="Kargoda"
          value={shipments.in_transit}
          variant="info"
        />
        <StatusCard
          icon={<AlertTriangle className="size-4" />}
          label="Geciken Kargolar"
          value={shipments.delayed}
          variant="destructive"
          onClick={() => setDelayedModalOpen(true)}
        />
        <StatusCard
          icon={<Bell className="size-4" />}
          label="Okunmamış Bildirim"
          value={unread_notifications}
          variant="secondary"
        />
      </div>

      {/* Tasks + Shipments summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Görevler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Yapılacak</span>
              <Badge variant="warning" appearance="light">{tasks.todo}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Devam Eden</span>
              <Badge variant="primary" appearance="light">{tasks.in_progress}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Toplam</span>
              <span className="font-medium">{tasks.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kargo Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Yolda</span>
              <Badge variant="primary" appearance="light">{shipments.in_transit}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Teslim Edildi</span>
              <Badge variant="success" appearance="light">{shipments.delivered}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Gecikmiş</span>
              <Badge variant="destructive" appearance="light">{shipments.delayed}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Genel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Aktif Ürünler</span>
              <span className="font-medium">{kpi.products}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>İptal Edilen</span>
              <Badge variant="secondary" appearance="light">{kpi.cancellations}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Teslim Edilen</span>
              <Badge variant="success" appearance="light">{kpi.delivered_orders}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" />
              <FormattedMessage id="DASHBOARD.TOP_PRODUCTS.TITLE" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {top_products.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku} · {Math.round(p.units)} adet
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 shrink-0">
                    {fmtTRY(p.revenue)}
                  </span>
                </div>
              ))}
              {top_products.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Henüz satış verisi yok
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" />
              <FormattedMessage id="DASHBOARD.LOW_STOCK.TITLE" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {low_stock.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={p.stock === 0 ? 'destructive' : 'warning'}
                      appearance="light"
                    >
                      {p.stock === 0
                        ? 'Tükendi'
                        : `${Math.round(p.stock)} kaldı`}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      / {Math.round(p.threshold)}
                    </span>
                  </div>
                </div>
              ))}
              {low_stock.length === 0 && (
                <div className="flex items-center gap-2 justify-center py-6 text-sm text-muted-foreground">
                  <CheckCircle className="size-4 text-success" />
                  Tüm stoklar yeterli
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>

      <DelayedShipmentsModal
        open={delayedModalOpen}
        onOpenChange={setDelayedModalOpen}
      />
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`shrink-0 size-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  icon,
  label,
  value,
  variant,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'warning' | 'info' | 'destructive' | 'secondary';
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}>
      <CardContent
        className="flex items-center justify-between p-4"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm">{label}</span>
        </div>
        <Badge variant={variant} appearance="light" className="text-base font-bold px-3">
          {value}
        </Badge>
      </CardContent>
    </Card>
  );
}
