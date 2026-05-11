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

interface Customer {
  id: number;
  full_name: string;
  phone: string | null;
  whatsapp_id: string | null;
  whatsapp_profile_name: string | null;
  whatsapp_opt_in: boolean;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function CustomersPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/customers?skip=0&limit=50'),
    staleTime: 30_000,
  });

  const items: Customer[] = data ?? [];

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.NAME' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.full_name}</span>
        ),
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.PHONE' })}
          />
        ),
        cell: ({ row }) => row.original.phone || '—',
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.EMAIL' })}
          />
        ),
        cell: ({ row }) => row.original.email || '—',
      },
      {
        accessorKey: 'city',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.CITY' })}
          />
        ),
        cell: ({ row }) => row.original.city || '—',
      },
      {
        accessorKey: 'whatsapp_opt_in',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.WHATSAPP' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.whatsapp_opt_in ? 'success' : 'secondary'}
            appearance="light"
          >
            <FormattedMessage
              id={
                row.original.whatsapp_opt_in
                  ? 'CUSTOMERS.WHATSAPP_ACTIVE'
                  : 'CUSTOMERS.WHATSAPP_INACTIVE'
              }
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'CUSTOMERS.CREATED_AT' })}
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
        title={<FormattedMessage id="CUSTOMERS.TITLE" />}
        description={<FormattedMessage id="CUSTOMERS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={intl.formatMessage({ id: 'CUSTOMERS.SEARCH' })}
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
