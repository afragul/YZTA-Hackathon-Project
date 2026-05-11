import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Package,
  Search,
  Sparkles,
} from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';
import {
  ProductDataCheckModal,
  ProductDataCheckResult,
} from './product-data-check-modal';

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: 'piece' | 'kg' | 'lt' | 'pack';
  price: string;
  stock: string;
  low_stock_threshold: string;
  is_active: boolean;
  image_key: string | null;
  created_at: string;
  updated_at: string;
}

const UNIT_LABELS: Record<Product['unit'], string> = {
  piece: 'Adet',
  kg: 'kg',
  lt: 'Lt',
  pack: 'Paket',
};

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});

export function ProductsPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      apiRequest<Product[]>('/products?skip=0&limit=50&active_only=false'),
    staleTime: 30_000,
  });

  const items: Product[] = data ?? [];

  const filteredItems = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    if (!query) return items;

    return items.filter((product) =>
      [
        product.sku,
        product.name,
        product.description,
        product.category,
        product.unit,
        product.price,
        product.stock,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [globalFilter, items]);

  const totalProducts = items.length;
  const activeProducts = items.filter((product) => product.is_active).length;
  const lowStockProducts = items.filter((product) => {
    const stock = Number(product.stock);
    const threshold = Number(product.low_stock_threshold);
    return threshold > 0 && stock < threshold;
  }).length;

  const dataCheckMutation = useMutation({
    mutationFn: (productId: number) =>
      apiRequest<ProductDataCheckResult>(
        `/products/${productId}/ai-data-check`,
        { method: 'POST' },
      ),
    onError: (error: Error) => {
      toast.error(error.message || 'AI analizi oluşturulamadı.');
    },
  });

  const runDataCheck = useCallback(
    (product: Product) => {
      setSelectedProduct(product);
      dataCheckMutation.reset();
      dataCheckMutation.mutate(product.id);
    },
    [dataCheckMutation],
  );

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="PRODUCTS.TITLE" />}
        description={<FormattedMessage id="PRODUCTS.SUBTITLE" />}
      />

      <Container>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryTile
              icon={<Package className="size-4" />}
              label="Toplam Ürün"
              value={totalProducts}
              tone="primary"
            />
            <SummaryTile
              icon={<CheckCircle2 className="size-4" />}
              label="Aktif Ürün"
              value={activeProducts}
              tone="success"
            />
            <SummaryTile
              icon={<AlertTriangle className="size-4" />}
              label="Düşük Stok"
              value={lowStockProducts}
              tone="danger"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 w-full sm:max-w-sm">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <Input
                placeholder={intl.formatMessage({ id: 'PRODUCTS.SEARCH' })}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredItems.length} / {totalProducts} ürün gösteriliyor
            </div>
          </div>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : filteredItems.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAnalyze={() => runDataCheck(product)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aramanızla eşleşen ürün bulunamadı.
            </div>
          )}
        </div>
      </Container>

      <ProductDataCheckModal
        open={selectedProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
        productName={selectedProduct?.name}
        result={dataCheckMutation.data}
        isLoading={dataCheckMutation.isPending}
        errorMessage={dataCheckMutation.error?.message}
        onRetry={() => {
          if (!selectedProduct) return;
          dataCheckMutation.reset();
          dataCheckMutation.mutate(selectedProduct.id);
        }}
      />
    </>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'primary' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-md',
            tone === 'primary' && 'bg-primary/10 text-primary',
            tone === 'success' && 'bg-success/10 text-success',
            tone === 'danger' && 'bg-destructive/10 text-destructive',
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-mono tabular-nums">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onAnalyze,
}: {
  product: Product;
  onAnalyze: () => void;
}) {
  const stock = Number(product.stock);
  const threshold = Number(product.low_stock_threshold);
  const isLow = threshold > 0 && stock < threshold;
  const stockFillPercent =
    threshold > 0 && isLow ? Math.min(100, (stock / threshold) * 100) : 100;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="min-h-auto py-4 gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-mono leading-6">
              {product.name}
            </h3>
            <Badge
              variant={product.is_active ? 'success' : 'secondary'}
              appearance="light"
            >
              <FormattedMessage
                id={product.is_active ? 'PRODUCTS.ACTIVE' : 'PRODUCTS.INACTIVE'}
              />
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            {product.sku}
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={onAnalyze}>
          <Sparkles />
          AI ile Analiz Et
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {product.description ? (
          <p className="text-sm text-muted-foreground leading-6 line-clamp-2">
            {product.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground leading-6">
            Açıklama bulunmuyor.
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoBlock label="Kategori">
            {product.category ? (
              <Badge variant="info" appearance="light">
                {product.category}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </InfoBlock>
          <InfoBlock label="Birim">
            <Badge variant="secondary" appearance="light">
              {UNIT_LABELS[product.unit] ?? product.unit}
            </Badge>
          </InfoBlock>
          <InfoBlock label="Fiyat">
            <span className="font-semibold text-mono tabular-nums">
              {currencyFormatter.format(Number(product.price))}
            </span>
          </InfoBlock>
          <InfoBlock label="Stok">
            <span className="font-semibold text-mono tabular-nums">{stock}</span>
          </InfoBlock>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Stok durumu</span>
            </div>
            <div className="flex items-center gap-2">
              {threshold > 0 ? (
                <span className="text-xs text-muted-foreground">
                  Düşük stok sınırı: {threshold}
                </span>
              ) : null}
              {isLow ? (
                <Badge variant="destructive" appearance="light">
                  <FormattedMessage id="PRODUCTS.LOW_STOCK" />
                </Badge>
              ) : (
                <Badge variant="success" appearance="light">
                  Yeterli
                </Badge>
              )}
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                isLow ? 'bg-destructive' : 'bg-emerald-500',
              )}
              style={{ width: `${Math.max(stockFillPercent, 4)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="min-h-6 flex items-center text-sm">{children}</div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="py-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-9 w-36" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
