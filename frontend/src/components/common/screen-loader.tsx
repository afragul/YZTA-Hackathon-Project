'use client';

import { toAbsoluteUrl } from '@/lib/helpers';

export function ScreenLoader() {
  return (
    <div className="flex flex-col items-center gap-3 justify-center fixed inset-0 z-50 bg-background transition-opacity duration-700 ease-in-out">
      <img
        className="h-[120px] max-w-none"
        src={toAbsoluteUrl('/media/app/kobai-loading.gif')}
        alt="Loading"
      />
      <div className="text-muted-foreground font-medium text-sm">
        Loading...
      </div>
    </div>
  );
}
