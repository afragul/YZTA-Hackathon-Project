import { Outlet } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Card, CardContent } from '@/components/ui/card';

export function BrandedLayout() {
  return (
    <>
      <style>
        {`
          .branded-bg {
            background-image: url('${toAbsoluteUrl('/media/app/kobai-signin.png')}');
          }
          .dark .branded-bg {
            background-image: url('${toAbsoluteUrl('/media/app/kobai-signin-dark.png')}');
          }
        `}
      </style>
      <div className="grid lg:grid-cols-2 grow">
        <div className="flex justify-center items-center p-8 lg:p-10 order-2 lg:order-1">
          <Card className="w-full max-w-[400px]">
            <CardContent className="p-6">
              <Outlet />
            </CardContent>
          </Card>
        </div>

        <div
          className="lg:rounded-xl lg:border lg:border-border lg:m-5 order-1 lg:order-2 bg-center bg-cover bg-no-repeat branded-bg min-h-[240px] lg:min-h-0"
          aria-hidden="true"
        />
      </div>
    </>
  );
}
