import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/context/auth-context';
import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
import {
  LayoutGrid,
  Layout,
  MessageSquare,
  Plug,
  Settings,
  ShoppingCart,
  TrendingUp,
  UserCircle,
} from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Link, useLocation } from 'react-router-dom';
import { getHeight } from '@/lib/dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useViewport } from '@/hooks/use-viewport';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  tooltipId: string;
  path: string;
  rootPath?: string;
}

const menuItems: MenuItem[] = [
  { icon: LayoutGrid, tooltipId: 'MENU.DASHBOARD', path: '/', rootPath: '/' },
  {
    icon: UserCircle,
    tooltipId: 'MENU.ACCOUNT',
    path: '/account/profile',
    rootPath: '/account/',
  },
  {
    icon: Settings,
    tooltipId: 'MENU.SETTINGS',
    path: '/settings/general',
    rootPath: '/settings/',
  },
  {
    icon: Layout,
    tooltipId: 'MENU.INVENTORY',
    path: '/inventory',
    rootPath: '/inventory',
  },
  {
    icon: TrendingUp,
    tooltipId: 'MENU.SALES',
    path: '/sales/orders',
    rootPath: '/sales/',
  },
  {
    icon: ShoppingCart,
    tooltipId: 'MENU.PRODUCTS',
    path: '/products',
    rootPath: '/products',
  },
  {
    icon: Plug,
    tooltipId: 'MENU.SHIPPING',
    path: '/shipping',
    rootPath: '/shipping',
  },
  {
    icon: MessageSquare,
    tooltipId: 'MENU.MESSAGES',
    path: '/messages/whatsapp',
    rootPath: '/messages/',
  },
];

export function SidebarPrimary() {
  const { user } = useAuth();
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [scrollableHeight, setScrollableHeight] = useState<number>(0);
  const [viewportHeight] = useViewport();
  const scrollableOffset = 80;
  const { pathname } = useLocation();

  useEffect(() => {
    if (headerRef.current && footerRef.current) {
      const headerHeight = getHeight(headerRef.current);
      const footerHeight = getHeight(footerRef.current);
      const availableHeight =
        viewportHeight - headerHeight - footerHeight - scrollableOffset;
      setScrollableHeight(availableHeight);
    } else {
      setScrollableHeight(viewportHeight);
    }
  }, [viewportHeight]);

  const [selectedMenuItem, setSelectedMenuItem] = useState(menuItems[0]);

  useEffect(() => {
    menuItems.forEach((item) => {
      if (
        item.rootPath === pathname ||
        (item.rootPath && pathname.includes(item.rootPath))
      ) {
        setSelectedMenuItem(item);
      }
    });
  }, [pathname]);

  return (
    <TooltipProvider>
      <div className="flex flex-col items-stretch shrink-0 gap-5 py-5 w-[70px] border-e border-input">
        <div
          ref={headerRef}
          className="hidden lg:flex items-center justify-center shrink-0"
        >
          <Link to="/">
            <img
              src={toAbsoluteUrl('/media/app/kobailogo.png')}
              className="min-h-[30px] max-h-[30px] w-auto"
              alt="Kobai"
            />
          </Link>
        </div>

        <div className="flex grow shrink-0">
          <div
            className="kt-scrollable-y-hover grow gap-2.5 shrink-0 flex ps-4 flex-col"
            style={{ height: `${scrollableHeight}px` }}
          >
            {menuItems.map((item, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    mode="icon"
                    {...(item === selectedMenuItem
                      ? { 'data-state': 'open' }
                      : {})}
                    className={cn(
                      'shrink-0 rounded-md size-9',
                      'data-[state=open]:bg-background data-[state=open]:border data-[state=open]:border-input data-[state=open]:text-primary',
                      'hover:bg-background hover:border hover:border-input hover:text-primary',
                    )}
                  >
                    <Link to={item.path}>
                      <item.icon className="size-4.5!" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <FormattedMessage
                    id={item.tooltipId}
                    defaultMessage={item.tooltipId}
                  />
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        <div
          ref={footerRef}
          className="flex flex-col gap-4 items-center shrink-0"
        >
          <UserDropdownMenu
            trigger={
              <img
                className="size-9 rounded-full border border-border shrink-0 cursor-pointer object-cover"
                src={user?.pic || toAbsoluteUrl('/media/avatars/300-2.png')}
                alt="User Avatar"
              />
            }
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
