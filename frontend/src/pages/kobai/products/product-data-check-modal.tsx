import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface ProductDataCheckFaq {
  question: string;
  data_status: string;
  needs_business_action: boolean;
  action_note: string | null;
}

export interface ProductDataCheckResult {
  product_id: number;
  sku: string;
  name: string;
  summary: string;
  strengths: string[];
  missing_info: string[];
  faq: ProductDataCheckFaq[];
  tags: string[];
  search_intents: string[];
  source: string;
}

interface ProductDataCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  result?: ProductDataCheckResult;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

export function ProductDataCheckModal({
  open,
  onOpenChange,
  productName,
  result,
  isLoading,
  errorMessage,
  onRetry,
}: ProductDataCheckModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI Ürün Veri Kontrolü
          </DialogTitle>
          <DialogDescription>
            {productName
              ? `${productName} için müşteri soruları ve veri eksikleri analiz ediliyor.`
              : 'Ürün kartı analiz ediliyor.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {isLoading ? <DataCheckSkeleton /> : null}

          {!isLoading && errorMessage ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-mono">
                    AI analizi oluşturulamadı
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!isLoading && result ? (
            <>
              <div className="rounded-lg border p-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-mono">
                      {result.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {result.sku}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{result.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" appearance="light">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <InsightList
                  title="Veride Bulunan Güçlü Alanlar"
                  icon={<CheckCircle2 className="size-4 text-success" />}
                  items={result.strengths}
                  empty="Güçlü alan bulunamadı."
                />
                <InsightList
                  title="İşletme İçin Eksik Veri"
                  icon={<AlertTriangle className="size-4 text-warning" />}
                  items={result.missing_info}
                  empty="Eksik veri uyarısı yok."
                />
              </div>

              <Section title="Müşterinin Sorabileceği Sorular">
                <div className="space-y-3">
                  {result.faq.map((item) => (
                    <div key={item.question} className="rounded-md bg-muted/20 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-mono leading-6">
                          {item.question}
                        </div>
                        <Badge
                          variant={item.needs_business_action ? 'warning' : 'success'}
                          appearance="light"
                          className="shrink-0"
                        >
                          {item.needs_business_action ? 'Eksik veri' : 'Veri yeterli'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Veri durumu
                        </div>
                        <p className="text-sm text-foreground leading-6">
                          {item.data_status}
                        </p>
                      </div>
                      {item.action_note ? (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            İşletme aksiyonu
                          </div>
                          <p className="text-sm text-muted-foreground leading-6">
                            {item.action_note}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Müşterinin Arayabileceği İfadeler"
                icon={<Search className="size-4" />}
              >
                <div className="flex flex-wrap gap-2">
                  {result.search_intents.map((intent) => (
                    <Badge key={intent} variant="outline">
                      {intent}
                    </Badge>
                  ))}
                </div>
              </Section>
            </>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button onClick={onRetry} disabled={isLoading}>
            <RefreshCw className={isLoading ? 'animate-spin' : ''} />
            Yeniden Analiz Et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataCheckSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-44" />
    </div>
  );
}

function InsightList({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  empty: string;
}) {
  return (
    <Section title={title} icon={icon}>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="text-sm leading-6 text-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </Section>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-mono">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}
