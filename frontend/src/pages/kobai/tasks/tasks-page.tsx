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

interface Task {
  id: number;
  title: string;
  description: string | null;
  task_type: 'pack_order' | 'ship_order' | 'restock' | 'general';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  assignee_id: number | null;
  related_order_id: number | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

type TaskStatus = Task['status'];
type TaskPriority = Task['priority'];

const STATUS_VARIANT: Record<TaskStatus, 'warning' | 'primary' | 'success' | 'destructive'> = {
  todo: 'warning',
  in_progress: 'primary',
  done: 'success',
  cancelled: 'destructive',
};

const PRIORITY_VARIANT: Record<TaskPriority, 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  normal: 'warning',
  high: 'destructive',
};

export function TasksPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiRequest<Task[]>('/tasks?skip=0&limit=50'),
    staleTime: 30_000,
  });

  const items: Task[] = data ?? [];

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'TASKS.TASK_TITLE' })}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: 'task_type',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'TASKS.TYPE' })}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" appearance="light">
            <FormattedMessage
              id={`TASKS.TYPE.${row.original.task_type.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'TASKS.STATUS' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={STATUS_VARIANT[row.original.status]}
            appearance="light"
          >
            <FormattedMessage
              id={`TASKS.STATUS.${row.original.status.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'TASKS.PRIORITY' })}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={PRIORITY_VARIANT[row.original.priority]}
            appearance="light"
          >
            <FormattedMessage
              id={`TASKS.PRIORITY.${row.original.priority.toUpperCase()}`}
            />
          </Badge>
        ),
      },
      {
        accessorKey: 'due_at',
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title={intl.formatMessage({ id: 'TASKS.DUE_DATE' })}
          />
        ),
        cell: ({ row }) =>
          row.original.due_at
            ? new Date(row.original.due_at).toLocaleDateString('tr-TR')
            : '—',
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
        title={<FormattedMessage id="TASKS.TITLE" />}
        description={<FormattedMessage id="TASKS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <DataGrid table={table} recordCount={items.length} isLoading={isLoading}>
            <CardHeader className="py-3.5 flex flex-col sm:flex-row flex-wrap gap-3 sm:items-center">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={intl.formatMessage({ id: 'TASKS.SEARCH' })}
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
