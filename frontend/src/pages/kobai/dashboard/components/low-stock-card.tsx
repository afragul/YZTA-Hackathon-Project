import { AlertTriangle } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { lowStock } from '../mock-data';

export function LowStockCard() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-yellow-500" />
          <FormattedMessage id="DASHBOARD.LOW_STOCK.TITLE" />
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/inventory/alerts">
            <FormattedMessage id="DASHBOARD.LOW_STOCK.SEE_ALL" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {lowStock.map((p) => {
          const out = p.stock === 0;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-mono truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.sku}</span>
              </div>
              <Badge
                variant={out ? 'destructive' : 'warning'}
                appearance="light"
                size="sm"
              >
                {out ? (
                  <FormattedMessage id="DASHBOARD.LOW_STOCK.OUT_OF_STOCK" />
                ) : (
                  <FormattedMessage
                    id="DASHBOARD.LOW_STOCK.UNITS_LEFT"
                    values={{ count: p.stock }}
                  />
                )}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
