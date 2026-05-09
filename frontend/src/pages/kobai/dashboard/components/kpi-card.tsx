import { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  trend?: number;
  hint?: ReactNode;
  icon?: ReactNode;
}

export function KpiCard({ label, value, trend, hint, icon }: KpiCardProps) {
  const positive = (trend ?? 0) >= 0;
  const TrendIcon = positive ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-start justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          {icon && (
            <div className="text-muted-foreground/70">{icon}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold text-mono tracking-tight">
            {value}
          </div>
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md',
                positive
                  ? 'text-green-700 bg-green-100 dark:bg-green-500/15 dark:text-green-400'
                  : 'text-red-700 bg-red-100 dark:bg-red-500/15 dark:text-red-400',
              )}
            >
              <TrendIcon className="size-3" />%
              {Math.abs(trend).toFixed(1)}
            </span>
          )}
        </div>
        {hint && (
          <div className="text-xs text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
