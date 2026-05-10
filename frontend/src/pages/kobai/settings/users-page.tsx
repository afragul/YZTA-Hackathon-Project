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

interface BackendUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function UsersPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiRequest<BackendUser[]>('/users'),
    staleTime: 30_000,
  });

  const items: BackendUser[] = data ?? [];

  const columns = useMemo<ColumnDef<BackendUser>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SETTINGS.USERS.NAME' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.full_name || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'username',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SETTINGS.USERS.USERNAME' })}
          />
        ),
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SETTINGS.USERS.EMAIL' })}
          />
        ),
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SETTINGS.USERS.ROLE' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.role === 'admin' ? 'primary' : 'secondary'}
            appearance="light"
          >
            <FormattedMessage
              id={
                row.original.role === 'admin'
                  ? 'ACCOUNT.PROFILE.ROLE_ADMIN'
                  : 'ACCOUNT.PROFILE.ROLE_USER'
              }
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'is_active',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'SETTINGS.USERS.STATUS' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.is_active ? 'success' : 'destructive'}
            appearance="light"
          >
            <FormattedMessage
              id={
                row.original.is_active
                  ? 'ACCOUNT.PROFILE.ACTIVE'
                  : 'ACCOUNT.PROFILE.INACTIVE'
              }
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
        title={<FormattedMessage id="SETTINGS.USERS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.USERS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder={intl.formatMessage({ id: 'COMMON.SEARCH' })}
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
