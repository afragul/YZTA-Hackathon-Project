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

interface Shipment {
  id: number;
  order_id: number;
  carrier: string | null;
  tracking_number: string | null;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delayed' | 'failed';
  expected_delivery: string | null;
  delivered_at: string | null;
  last_event: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

type ShipmentStatus = Shipment['status'];

const STATUS_VARIANT: Record<ShipmentStatus, 'warning' | 'primary' | 'info' | 'success' | 'secondary' | 'destructive'> = {
  pending: 'warning',
  in_transit: 'primary',
  out_for_delivery: 'info',
  delivered: 'success',
  delayed: 'secondary',
  failed: 'destructive',
};

export function ShipmentsPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => apiRequest<Shipment[]>('/shipments?skip=0&limit=50'),
    staleTime: 30_000,
  });

  const items: Shipment[] = data ?? [];

  const columns = useMemo<ColumnDef<Shipment>[]>(
    () => [
      {
        accessorKey: 'order_id',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.ORDER' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">#{row.original.order_id}</span>
        ),
      },
      {
        accessorKey: 'carrier',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.CARRIER' })}
          />
        ),
        cell: ({ row }) => row.original.carrier || '—',
      },
      {
        accessorKey: 'tracking_number',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.TRACKING' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.tracking_number || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.STATUS' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={STATUS_VARIANT[row.original.status]}
            appearance="light"
          >
            <FormattedMessage
              id={`SHIPMENTS.STATUS.${row.original.status.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'expected_delivery',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.EXPECTED' })}
          />
        ),
        cell: ({ row }) =>
          row.original.expected_delivery
            ? new Date(row.original.expected_delivery).toLocaleDateString('tr-TR')
            : '—',
      },
      {
        accessorKey: 'last_event',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SHIPMENTS.LAST_EVENT' })}
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.last_event || '—'}
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
        title={<FormattedMessage id="SHIPMENTS.TITLE" />}
        description={<FormattedMessage id="SHIPMENTS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder={intl.formatMessage({ id: 'SHIPMENTS.SEARCH' })}
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
