import { FormattedMessage, useIntl } from 'react-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { topProducts } from '../mock-data';
import { fmtTRY } from '../format';

export function TopProductsCard() {
  const intl = useIntl();
  const max = Math.max(...topProducts.map((p) => p.units));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <FormattedMessage id="DASHBOARD.TOP_PRODUCTS.TITLE" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topProducts.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-mono truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.sku}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-medium text-mono">
                  {fmtTRY(p.revenue, intl.locale)}
                </span>
                <span className="text-xs text-muted-foreground">
                  <FormattedMessage
                    id="DASHBOARD.TOP_PRODUCTS.UNITS"
                    values={{ count: p.units }}
                  />
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round((p.units / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
