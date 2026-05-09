import { ReactNode } from 'react';
import { Container } from '@/components/common/container';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Container className="mb-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-mono">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </Container>
  );
}
