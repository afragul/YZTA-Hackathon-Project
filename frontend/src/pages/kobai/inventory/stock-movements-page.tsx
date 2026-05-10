import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Card, CardFooter, CardHeader, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';

interface Product {
  id: number;
  sku: string;
  name: string;
}

interface StockMovement {
  id: number;
  product_id: number;
  movement_type: 'in' | 'out' | 'adjustment';
  quantity: string;
  reason: string | null;
  order_id: number | null;
  created_at: string;
}

type MovementType = StockMovement['movement_type'];

const TYPE_VARIANT: Record<MovementType, 'success' | 'destructive' | 'warning'> = {
  in: 'success',
  out: 'destructive',
  adjustment: 'warning',
};

export function StockMovementsPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  // Fetch products for name lookup
  const { data: products } = useQuery({
    queryKey: ['products-lookup'],
    queryFn: () => apiRequest<Product[]>('/products?skip=0&limit=200&active_only=false'),
    staleTime: 60_000,
  });

  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    (products ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Fetch stock movements for all products
  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements-all'],
    queryFn: async () => {
      const prods = products ?? [];
      const all: StockMovement[] = [];
      for (const p of prods.slice(0, 20)) {
        const movements = await apiRequest<StockMovement[]>(
          `/products/${p.id}/stock-movements?skip=0&limit=50`,
        );
        all.push(...movements);
      }
      return all.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!products && products.length > 0,
    staleTime: 30_000,
  });

  const items: StockMovement[] = data ?? [];

  const columns = useMemo<ColumnDef<StockMovement>[]>(
    () => [
      {
        id: 'product_name',
        accessorFn: (row) => productMap.get(row.product_id)?.name ?? `#${row.product_id}`,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.PRODUCT' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {productMap.get(row.original.product_id)?.name ?? `#${row.original.product_id}`}
          </span>
        ),
      },
      {
        accessorKey: 'movement_type',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.TYPE' })}
          />
        ),
        cell: ({ row }) => (
          <Badge variant={TYPE_VARIANT[row.original.movement_type]} appearance="light">
            <FormattedMessage
              id={`INVENTORY.TYPE.${row.original.movement_type.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'quantity',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.QUANTITY' })}
          />
        ),
        cell: ({ row }) => Number(row.original.quantity).toLocaleString('tr-TR'),
      },
      {
        accessorKey: 'reason',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.REASON' })}
          />
        ),
        cell: ({ row }) => row.original.reason || '—',
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.DATE' })}
          />
        ),
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString('tr-TR'),
      },
    ],
    [intl, productMap],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="INVENTORY.MOVEMENTS.TITLE" />}
        description={<FormattedMessage id="INVENTORY.MOVEMENTS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder={intl.formatMessage({ id: 'INVENTORY.SEARCH' })}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="h-8 w-40 lg:w-60"
                />
              </div>
            </CardHeader>
            <CardTable>
              <ScrollArea>
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
            <CardFooter className="justify-center">
              <DataGridPagination />
            </CardFooter>
          </DataGrid>
        </Card>
      </Container>
    </>
  );
}
