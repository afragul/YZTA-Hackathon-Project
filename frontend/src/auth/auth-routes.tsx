import { RouteObject } from 'react-router-dom';
import { BrandedLayout } from './layouts/branded';
import { CallbackPage } from './pages/callback-page';
import { SignInPage } from './pages/signin-page';

export const authRoutes: RouteObject[] = [
  {
    path: '',
    element: <BrandedLayout />,
    children: [
      {
        path: 'signin',
        element: <SignInPage />,
      },
    ],
  },
  {
    path: 'callback',
    element: <CallbackPage />,
  },
];
