import { ReactNode, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  Loader2,
  Package,
  ShoppingCart,
  Truck,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'text-blue-600 bg-blue-50',
  warning: 'text-amber-600 bg-amber-50',
  critical: 'text-red-600 bg-red-50',
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  low_stock: Package,
  order_created: ShoppingCart,
  shipment_delayed: Truck,
  task_assigned: Zap,
  agent_action: Zap,
  whatsapp_inbound: Bell,
  info: Info,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Notification[]>(
        '/notifications?skip=0&limit=30&unread_only=false',
      );
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread count on mount (for badge on trigger)
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest<{ marked_count: number }>('/notifications/mark-all-read', {
        method: 'POST',
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true })),
      );
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiRequest<Notification>(`/notifications/${id}/read`, {
        method: 'PATCH',
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently fail
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="relative">
          {trigger}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 size-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-[420px] sm:max-w-none inset-5 start-auto h-auto rounded-lg [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">
        <SheetHeader className="mb-0 border-b border-border">
          <SheetTitle className="p-4 flex items-center gap-2">
            <Bell className="size-5" />
            Bildirimler
            {unreadCount > 0 && (
              <Badge variant="destructive" size="sm">
                {unreadCount}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="grow p-0">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle className="size-8 mb-2 opacity-50" />
                <p className="text-sm">Bildirim yok</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => {
                  const Icon = TYPE_ICON[n.type] || Info;
                  return (
                    <button
                      key={n.id}
                      onClick={() => !n.is_read && void handleMarkRead(n.id)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 text-left border-b border-border transition-colors hover:bg-muted/50',
                        !n.is_read && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'shrink-0 size-8 rounded-full flex items-center justify-center mt-0.5',
                          SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info,
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              'text-sm truncate',
                              !n.is_read && 'font-semibold',
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="size-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetBody>
        <SheetFooter className="border-t border-border p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0}
          >
            Tümünü okundu işaretle
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
