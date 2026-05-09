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
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';
import { Toolbar, ToolbarActions, ToolbarHeading } from './components/toolbar';

export function Demo4Layout() {
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(MENU_SIDEBAR);
  const { setOption } = useSettings();
  const isMobileMode = useIsMobile();
  const intl = useIntl();
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

          <div className="flex grow rounded-xl bg-background border border-input lg:ms-(--sidebar-width) mt-0 lg:mt-5 m-5">
            <div className="flex flex-col grow kt-scrollable-y-auto lg:[--kt-scrollbar-width:auto] pt-5">
              <main className="grow" role="content">
                <Toolbar>
                  <ToolbarHeading />

                  <ToolbarActions>
                    <>
                      {pathname.startsWith('/store-client') ? (
                        <StoreClientTopbar />
                      ) : (
                        <>
                          <SearchDialog
                            trigger={
                              <Button
                                variant="ghost"
                                mode="icon"
                                className="hover:bg-primary/10 hover:[&_svg]:text-primary"
                              >
                                <Search className="size-4.5!" />
                              </Button>
                            }
                          />
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

                <Outlet />
              </main>

              <Footer />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
