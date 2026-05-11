import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Mail,
  Send,
  Truck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api-client';

interface DelayedShipment {
  shipment_id: number;
  tracking_number: string | null;
  carrier: string | null;
  expected_delivery: string | null;
  last_event: string | null;
  order_id: number | null;
  order_number: string | null;
  order_total: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

interface NotifyResult {
  sent_count: number;
  failed_count: number;
  details: Array<{
    customer_id: number;
    customer_name: string;
    email?: string;
    status: 'sent' | 'failed' | 'skipped';
    detail: string | null;
  }>;
}

type Step = 'list' | 'recipients' | 'result';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DelayedShipmentsModal({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>('list');
  const [shipments, setShipments] = useState<DelayedShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recipients step
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(
    new Set(),
  );
  const [subject, setSubject] = useState('Kargonuz Gecikti — Bilgilendirme');
  const [message, setMessage] = useState(
    'Siparişinizin kargosunda bir gecikme yaşandığını bildirmek isteriz. ' +
    'Kargo firması ile iletişime geçilmiş olup, teslimatın en kısa sürede ' +
    'gerçekleştirilmesi için takip edilmektedir. Anlayışınız için teşekkür ederiz.',
  );

  // Result step
  const [result, setResult] = useState<NotifyResult | null>(null);

  const fetchDelayed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DelayedShipment[]>(
        '/dashboard/delayed-shipments',
      );
      setShipments(data);
    } catch {
      setError('Geciken kargolar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStep('list');
      setResult(null);
      setSelectedCustomerIds(new Set());
      setSubject('Kargonuz Gecikti — Bilgilendirme');
      setMessage(
        'Siparişinizin kargosunda bir gecikme yaşandığını bildirmek isteriz. ' +
        'Kargo firması ile iletişime geçilmiş olup, teslimatın en kısa sürede ' +
        'gerçekleştirilmesi için takip edilmektedir. Anlayışınız için teşekkür ederiz.',
      );
      void fetchDelayed();
    }
  }, [open, fetchDelayed]);

  // Unique customers with email
  const uniqueCustomers = shipments.reduce(
    (acc, s) => {
      if (s.customer_id && s.customer_email && !acc.find((c) => c.id === s.customer_id)) {
        acc.push({
          id: s.customer_id,
          name: s.customer_name || '-',
          email: s.customer_email,
          phone: s.customer_phone,
        });
      }
      return acc;
    },
    [] as Array<{ id: number; name: string; email: string; phone: string | null }>,
  );

  const handleGoToRecipients = () => {
    // Pre-select all customers with email
    setSelectedCustomerIds(new Set(uniqueCustomers.map((c) => c.id)));
    setStep('recipients');
  };

  const toggleCustomer = (id: number) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendNotifications = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await apiRequest<NotifyResult>(
        '/dashboard/delayed-shipments/notify',
        {
          method: 'POST',
          body: {
            customer_ids: Array.from(selectedCustomerIds),
            subject,
            message: message.trim() || undefined,
          },
        },
      );
      setResult(res);
      setStep('result');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Mail gönderimi başarısız oldu.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-destructive" />
            {step === 'list' && 'Geciken Kargolar'}
            {step === 'recipients' && 'Mail Bildirimi Gönder'}
            {step === 'result' && 'Gönderim Sonucu'}
          </DialogTitle>
          <DialogDescription>
            {step === 'list' &&
              'Teslim tarihi geçmiş kargolar aşağıda listelenmiştir.'}
            {step === 'recipients' &&
              'Bildirim gönderilecek müşterileri seçin ve mesajınızı düzenleyin.'}
            {step === 'result' && 'E-posta gönderim sonuçları:'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive mb-3">
              {error}
            </div>
          )}

          {/* Step 1: List delayed shipments */}
          {step === 'list' && (
            <ScrollArea className="max-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : shipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle className="size-8 mb-2 text-success" />
                  <p className="text-sm">Geciken kargo bulunmuyor.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {shipments.map((s) => (
                    <div
                      key={s.shipment_id}
                      className="flex items-center justify-between py-3 px-1 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            #{s.order_number}
                          </span>
                          <Badge
                            variant="destructive"
                            appearance="light"
                            size="sm"
                          >
                            Gecikmiş
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.customer_name} •{' '}
                          {s.carrier || 'Kargo firması belirtilmemiş'}
                          {s.tracking_number && ` • ${s.tracking_number}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Beklenen teslim:{' '}
                          <span className="text-destructive font-medium">
                            {s.expected_delivery || '-'}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                          {s.customer_email || (
                            <span className="text-destructive">Mail yok</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Step 2: Select recipients + compose */}
          {step === 'recipients' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Müşteriler ({selectedCustomerIds.size}/{uniqueCustomers.length}{' '}
                  seçili)
                </Label>
                <ScrollArea className="max-h-[180px] border rounded-md">
                  <div className="divide-y divide-border">
                    {uniqueCustomers.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.has(c.id)}
                          onChange={() => toggleCustomer(c.id)}
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {c.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-1.5">
                <Label>Konu</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Mesaj{' '}
                  <span className="text-muted-foreground font-normal">
                    (düzenleyebilirsiniz)
                  </span>
                </Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Siparişinizin kargosunda bir gecikme yaşanmaktadır..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="size-4 text-success" />
                  <span>
                    <strong>{result.sent_count}</strong> gönderildi
                  </span>
                </div>
                {result.failed_count > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="size-4 text-destructive" />
                    <span>
                      <strong>{result.failed_count}</strong> başarısız
                    </span>
                  </div>
                )}
              </div>
              <ScrollArea className="max-h-[280px] border rounded-md">
                <div className="divide-y divide-border">
                  {result.details.map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{d.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.email || 'E-posta yok'}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {d.status === 'sent' && (
                          <Badge variant="success" appearance="light" size="sm">
                            Gönderildi
                          </Badge>
                        )}
                        {d.status === 'failed' && (
                          <Badge
                            variant="destructive"
                            appearance="light"
                            size="sm"
                          >
                            Başarısız
                          </Badge>
                        )}
                        {d.status === 'skipped' && (
                          <Badge
                            variant="secondary"
                            appearance="light"
                            size="sm"
                          >
                            Atlandı
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'list' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Kapat
              </Button>
              {shipments.length > 0 && uniqueCustomers.length > 0 && (
                <Button onClick={handleGoToRecipients}>
                  <Mail className="size-4 me-2" />
                  Müşterilere Mail Bildirimi Gönder
                </Button>
              )}
            </>
          )}
          {step === 'recipients' && (
            <>
              <Button variant="outline" onClick={() => setStep('list')}>
                Geri
              </Button>
              <Button
                onClick={handleSendNotifications}
                disabled={sending || selectedCustomerIds.size === 0}
              >
                {sending ? (
                  <Loader2 className="size-4 me-2 animate-spin" />
                ) : (
                  <Send className="size-4 me-2" />
                )}
                Mail Gönder ({selectedCustomerIds.size} kişi)
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>Tamam</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
