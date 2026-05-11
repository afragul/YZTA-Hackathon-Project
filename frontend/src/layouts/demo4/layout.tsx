import { useEffect } from 'react';
import { StoreClientTopbar } from '@/pages/store-client/components/common/topbar';
import { SearchDialog } from '@/partials/dialogs/search/search-dialog';
import { NotificationsSheet } from '@/partials/topbar/notifications-sheet';
import { MessageSquareDot, Search } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useIntl } from 'react-intl';
import { Outlet, useLocation } from 'react-router-dom';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { useBodyClass } from '@/hooks/use-body-class';
import { useMenu } from '@/hooks/use-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';
import { Toolbar, ToolbarActions, ToolbarHeading } from './components/toolbar';
import { AssistantWidget } from '@/partials/assistant/assistant-widget';

export function Demo4Layout() {
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(MENU_SIDEBAR);
  const { setOption } = useSettings();
  const isMobileMode = useIsMobile();
  const intl = useIntl();
  const isChatRoute = pathname.startsWith('/messages/');
  const sectionTitle = item?.title
    ? intl.formatMessage({ id: item.title, defaultMessage: item.title })
    : '';
  const pageTitle = sectionTitle
    ? `${sectionTitle} | Kobai`
    : 'Kobai | Akıllı Ticaret';

  // Using the custom hook to set multiple CSS variables and class properties
  useBodyClass(`
    [--header-height:60px] 
    [--sidebar-width:290px] 
    lg:overflow-hidden 
    bg-muted!
  `);

  useEffect(() => {
    setOption('layout', 'demo4');
  }, [setOption]);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      <div className="flex grow">
        {isMobileMode && <Header />}

        <div className="flex flex-col lg:flex-row grow pt-(--header-height) lg:pt-0">
          {!isMobileMode && <Sidebar />}

          <div
            className={cn(
              'flex grow rounded-xl bg-background border border-input lg:ms-(--sidebar-width) mt-0 lg:mt-5 m-5',
              isChatRoute && 'overflow-hidden min-h-0',
            )}
          >
            <div
              className={cn(
                'flex flex-col grow lg:[--kt-scrollbar-width:auto]',
                isChatRoute
                  ? 'overflow-hidden min-h-0'
                  : 'kt-scrollable-y-auto pt-5',
              )}
            >
              <main className="grow flex flex-col min-h-0" role="content">
                {!isChatRoute && (
                  <Toolbar>
                    <ToolbarHeading />

                    <ToolbarActions>
                      <>
                        {pathname.startsWith('/store-client') ? (
                          <StoreClientTopbar />
                        ) : (
                          <>
                            <NotificationsSheet
                              trigger={
                                <Button
                                  variant="ghost"
                                  mode="icon"
                                  className="hover:bg-primary/10 hover:[&_svg]:text-primary"
                                >
                                  <MessageSquareDot className="size-4.5!" />
                                </Button>
                              }
                            />
                          </>
                        )}
                      </>
                    </ToolbarActions>
                  </Toolbar>
                )}

                <Outlet />
              </main>

              {!isChatRoute && <Footer />}
            </div>
          </div>
        </div>
      </div>
      <AssistantWidget />
    </>
  );
}
