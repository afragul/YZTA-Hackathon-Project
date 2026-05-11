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

export function ProductsPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      apiRequest<Product[]>('/products?skip=0&limit=50&active_only=false'),
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
        accessorKey: 'unit',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.UNIT' })}
          />
        ),
        cell: ({ row }) => row.original.unit,
      },
      {
        accessorKey: 'price',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.PRICE' })}
          />
        ),
        cell: ({ row }) =>
          new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
          }).format(Number(row.original.price)),
      },
      {
        accessorKey: 'stock',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.STOCK' })}
          />
        ),
        cell: ({ row }) => {
          const stock = Number(row.original.stock);
          const threshold = Number(row.original.low_stock_threshold);
          return (
            <div className="flex items-center gap-2">
              <span>{stock}</span>
              {stock <= threshold && (
                <Badge variant="destructive" appearance="light">
                  <FormattedMessage id="PRODUCTS.LOW_STOCK" />
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'is_active',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'PRODUCTS.STATUS' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.is_active ? 'success' : 'secondary'}
            appearance="light"
          >
            <FormattedMessage
              id={row.original.is_active ? 'PRODUCTS.ACTIVE' : 'PRODUCTS.INACTIVE'}
            />
          </Badge>
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
        title={<FormattedMessage id="PRODUCTS.TITLE" />}
        description={<FormattedMessage id="PRODUCTS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={intl.formatMessage({ id: 'PRODUCTS.SEARCH' })}
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
