import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import {
  whatsappChatApi,
  type WhatsAppConversation,
} from './api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversation: WhatsAppConversation) => void;
}

function normalizePhone(value: string): string {
  let v = value.replace(/[^\d+]/g, '');
  if (v && !v.startsWith('+')) v = '+' + v;
  return v;
}

export function NewChatDialog({ open, onOpenChange, onCreated }: Props) {
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setContactName('');
    setBody('');
    setError(null);
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.replace(/\D/g, '').length < 8) {
      setError('Geçerli bir telefon numarası girin (E.164).');
      return;
    }
    if (!body.trim()) {
      setError('Boş mesaj gönderilemez.');
      return;
    }
    setSubmitting(true);
    try {
      const conv = await whatsappChatApi.startConversation({
        to_phone_e164: normalized,
        body: body.trim(),
        contact_name: contactName.trim() || null,
      });
      onCreated(conv);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? typeof e.data === 'object' && e.data
            ? (e.data as { detail?: string }).detail || e.message
            : e.message
          : 'Gönderim sırasında bir hata oluştu.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni WhatsApp Sohbeti</DialogTitle>
          <DialogDescription>
            Numara serbest mesajlar için son 24 saatte size yazmış veya Meta'da
            test numarası olarak tanımlanmış olmalıdır.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label>Telefon (E.164)</Label>
            <Input
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+905551234567"
            />
          </div>
          <div className="space-y-1.5">
            <Label>İsim (opsiyonel)</Label>
            <Input
              autoComplete="off"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Müşteri adı"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mesaj</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Merhaba, size nasıl yardımcı olabiliriz?"
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting && <Loader2 className="size-4 me-2 animate-spin" />}
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
