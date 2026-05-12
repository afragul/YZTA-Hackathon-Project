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
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { Card, CardFooter, CardHeader, CardTable } from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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

const AiWorkflowTrigger = ({ onComplete }: { onComplete: () => void }) => {
  const [loading, setLoading] = useState(false);

  const runWorkflow = async () => {
    setLoading(true);
    try {
      // Backend'deki endpointine istek atıyoruz
      const response = await apiRequest('/tasks/run-ai-workflow', {
        method: 'POST',
      });
      toast.success("AI Operasyonu Tamamlandı!");
      onComplete(); // Başarılı olunca listeyi yenilemek için
    } catch (error) {
      toast.error("AI çalışırken bir hata oluştu.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl mb-6">
      <div className="flex flex-col flex-1">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Otonom İş Akışı Yönetimi
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          Bekleyen tüm siparişleri analiz edip ekiplere otomatik iş dağıtmak ister misiniz?
        </p>
      </div>
      <Button
        onClick={runWorkflow}
        disabled={loading}
        className="bg-primary hover:bg-primary/90 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            AI Düşünüyor...
          </>
        ) : (
          " Operasyonu Başlat"
        )}
      </Button>
    </div>
  );
};


export function TasksPage() {
  const intl = useIntl();
  const [globalFilter, setGlobalFilter] = useState('');

  const { data, isLoading, refetch } = useQuery({
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
        <AiWorkflowTrigger onComplete={() => refetch()} />
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
