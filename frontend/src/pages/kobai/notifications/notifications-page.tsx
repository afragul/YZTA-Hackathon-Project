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
import { CheckCircle, Circle, Search } from 'lucide-react';
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

interface Notification {
  id: number;
  user_id: number | null;
  type: 'low_stock' | 'order_created' | 'shipment_delayed' | 'task_assigned' | 'agent_action' | 'whatsapp_inbound' | 'info';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

type NotificationSeverity = Notification['severity'];

const SEVERITY_VARIANT: Record<NotificationSeverity, 'info' | 'warning' | 'destructive'> = {
  info: 'info',
  warning: 'warning',
  critical: 'destructive',
};

export function NotificationsPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<Notification[]>('/notifications?skip=0&limit=50&unread_only=false'),
    staleTime: 30_000,
  });

  const items: Notification[] = data ?? [];

  const columns = useMemo<ColumnDef<Notification>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'NOTIFICATIONS.NOTIF_TITLE' })}
          />
        ),
        cell: ({ row }) => (
          <span className={row.original.is_read ? '' : 'font-medium'}>
            {row.original.title}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'NOTIFICATIONS.TYPE' })}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" appearance="light">
            <FormattedMessage
              id={`NOTIFICATIONS.TYPE.${row.original.type.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'severity',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'NOTIFICATIONS.SEVERITY' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={SEVERITY_VARIANT[row.original.severity]}
            appearance="light"
          >
            <FormattedMessage
              id={`NOTIFICATIONS.SEVERITY.${row.original.severity.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'is_read',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'NOTIFICATIONS.READ' })}
          />
        ),
        cell: ({ row }) =>
          row.original.is_read ? (
            <CheckCircle className="size-4 text-success" />
          ) : (
            <Circle className="size-4 text-muted-foreground" />
          ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'NOTIFICATIONS.DATE' })}
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
        title={<FormattedMessage id="NOTIFICATIONS.TITLE" />}
        description={<FormattedMessage id="NOTIFICATIONS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={intl.formatMessage({ id: 'NOTIFICATIONS.SEARCH' })}
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
