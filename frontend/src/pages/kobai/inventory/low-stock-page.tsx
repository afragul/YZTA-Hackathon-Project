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
import { AlertTriangle, Search } from 'lucide-react';
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
  category: string | null;
  unit: string;
  stock: string;
  low_stock_threshold: string;
  is_active: boolean;
}

export function LowStockPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products-low-stock'],
    queryFn: () => apiRequest<Product[]>('/products/low-stock'),
    staleTime: 30_000,
  });

  const items: Product[] = data ?? [];

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'sku',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.SKU' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.NAME' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.CATEGORY' })}
          />
        ),
        cell: ({ row }) => row.original.category || '—',
      },
      {
        accessorKey: 'stock',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.CURRENT_STOCK' })}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <span className="font-semibold text-destructive">
              {Number(row.original.stock).toLocaleString('tr-TR')}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.unit}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'low_stock_threshold',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'INVENTORY.THRESHOLD' })}
          />
        ),
        cell: ({ row }) => (
          <span>
            {Number(row.original.low_stock_threshold).toLocaleString('tr-TR')}{' '}
            <span className="text-xs text-muted-foreground">{row.original.unit}</span>
          </span>
        ),
      },
    ],
    [intl],
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
        title={<FormattedMessage id="INVENTORY.LOW_STOCK.TITLE" />}
        description={<FormattedMessage id="INVENTORY.LOW_STOCK.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={intl.formatMessage({ id: 'INVENTORY.SEARCH' })}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="h-8 w-full sm:w-40 lg:w-60"
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
