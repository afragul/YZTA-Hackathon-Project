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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';

interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: string;
  unit_price: string;
  subtotal: string;
}

interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: string;
  currency: string;
  note: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

type OrderStatus = Order['status'];

const STATUS_VARIANT: Record<OrderStatus, 'warning' | 'primary' | 'info' | 'secondary' | 'success' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'primary',
  preparing: 'info',
  shipped: 'secondary',
  delivered: 'success',
  cancelled: 'destructive',
};

export function OrdersPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ skip: '0', limit: '50', today_only: 'false' });
      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      return apiRequest<Order[]>(`/orders?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const items: Order[] = data ?? [];

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: 'order_number',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'ORDERS.ORDER_NUMBER' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.order_number}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'ORDERS.STATUS' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={STATUS_VARIANT[row.original.status]}
            appearance="light"
          >
            <FormattedMessage
              id={`ORDERS.STATUS.${row.original.status.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'total_amount',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'ORDERS.TOTAL' })}
          />
        ),
        cell: ({ row }) =>
          new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: row.original.currency || 'TRY',
          }).format(Number(row.original.total_amount)),
      },
      {
        id: 'items_count',
        accessorFn: (row) => row.items?.length ?? 0,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'ORDERS.ITEMS' })}
          />
        ),
        cell: ({ row }) => row.original.items?.length ?? 0,
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'ORDERS.DATE' })}
          />
        ),
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString('tr-TR'),
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
        title={<FormattedMessage id="ORDERS.TITLE" />}
        description={<FormattedMessage id="ORDERS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder={intl.formatMessage({ id: 'ORDERS.SEARCH' })}
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="h-8 w-40 lg:w-60"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {intl.formatMessage({ id: 'ORDERS.ALL_STATUSES' })}
                    </SelectItem>
                    <SelectItem value="pending">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.PENDING' })}
                    </SelectItem>
                    <SelectItem value="confirmed">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.CONFIRMED' })}
                    </SelectItem>
                    <SelectItem value="preparing">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.PREPARING' })}
                    </SelectItem>
                    <SelectItem value="shipped">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.SHIPPED' })}
                    </SelectItem>
                    <SelectItem value="delivered">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.DELIVERED' })}
                    </SelectItem>
                    <SelectItem value="cancelled">
                      {intl.formatMessage({ id: 'ORDERS.STATUS.CANCELLED' })}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
