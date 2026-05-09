import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Item {
  label: ReactNode;
  value: ReactNode;
}

interface DefinitionListProps {
  items: Item[];
  className?: string;
}

export function DefinitionList({ items, className }: DefinitionListProps) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 first:pt-0 last:pb-0"
        >
          <dt className="text-sm text-muted-foreground sm:w-44 sm:shrink-0">
            {item.label}
          </dt>
          <dd className="text-sm text-mono break-all">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
