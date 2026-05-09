import {
  AlertCircle,
  Award,
  Badge,
  Bell,
  Bitcoin,
  Bolt,
  Book,
  Briefcase,
  Building,
  CalendarCheck,
  Captions,
  CheckCircle,
  Code,
  Codepen,
  Coffee,
  File as DocumentIcon,
  Euro,
  Eye,
  File,
  FileQuestion,
  FileText,
  Flag,
  Ghost,
  Gift,
  Grid,
  Heart,
  HelpCircle,
  Kanban,
  Key,
  Layout,
  LayoutGrid,
  LifeBuoy,
  MessageSquare,
  Monitor,
  Network,
  Users as PeopleIcon,
  Plug,
  ScrollText,
  Settings,
  Share2,
  Shield,
  ShieldOff,
  ShieldUser,
  ShoppingCart,
  SquareMousePointer,
  Star,
  Theater,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  UserCircle,
  Users,
  Briefcase as WorkIcon,
  Zap,
} from 'lucide-react';
import { type MenuConfig } from './types';

export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'MENU.DASHBOARD',
    icon: LayoutGrid,
    path: '/',
  },
  {
    title: 'MENU.ACCOUNT',
    icon: UserCircle,
    children: [
      { title: 'MENU.ACCOUNT.PROFILE', path: '/account/profile' },
    ],
  },
  {
    title: 'MENU.SETTINGS',
    icon: Settings,
    children: [
      { title: 'MENU.SETTINGS.GENERAL', path: '/settings/general' },
      { title: 'MENU.SETTINGS.APPEARANCE', path: '/settings/appearance' },
      { title: 'MENU.SETTINGS.INTEGRATIONS', path: '/settings/integrations' },
      { title: 'MENU.SETTINGS.API_KEYS', path: '/settings/api-keys' },
      { title: 'MENU.SETTINGS.USERS', path: '/settings/users' },
    ],
  },
  { heading: 'MENU.HEADING.OPERATIONS' },
  {
    title: 'MENU.INVENTORY',
    icon: Layout,
    children: [
      { title: 'MENU.INVENTORY.LIST', path: '/inventory' },
      { title: 'MENU.INVENTORY.ALERTS', path: '/inventory/alerts' },
      { title: 'MENU.INVENTORY.MOVEMENTS', path: '/inventory/movements' },
      { title: 'MENU.INVENTORY.SUPPLIERS', path: '/inventory/suppliers' },
      {
        title: 'MENU.INVENTORY.AI_SUGGESTIONS',
        path: '/inventory/ai-suggestions',
      },
    ],
  },
  {
    title: 'MENU.SALES',
    icon: TrendingUp,
    children: [
      { title: 'MENU.SALES.ORDERS', path: '/sales/orders' },
      { title: 'MENU.SALES.PENDING', path: '/sales/pending' },
      { title: 'MENU.SALES.COMPLETED', path: '/sales/completed' },
      { title: 'MENU.SALES.REFUNDS', path: '/sales/refunds' },
      { title: 'MENU.SALES.CUSTOMERS', path: '/sales/customers' },
      { title: 'MENU.SALES.REPORTS', path: '/sales/reports' },
    ],
  },
  {
    title: 'MENU.PRODUCTS',
    icon: ShoppingCart,
    children: [
      { title: 'MENU.PRODUCTS.LIST', path: '/products' },
      { title: 'MENU.PRODUCTS.NEW', path: '/products/new' },
      { title: 'MENU.PRODUCTS.CATEGORIES', path: '/products/categories' },
      { title: 'MENU.PRODUCTS.IMPORT', path: '/products/import' },
      { title: 'MENU.PRODUCTS.PRICING', path: '/products/pricing' },
    ],
  },
  {
    title: 'MENU.SHIPPING',
    icon: Plug,
    children: [
      { title: 'MENU.SHIPPING.ACTIVE', path: '/shipping' },
      { title: 'MENU.SHIPPING.DELAYS', path: '/shipping/delays' },
      { title: 'MENU.SHIPPING.DELIVERED', path: '/shipping/delivered' },
      { title: 'MENU.SHIPPING.CARRIERS', path: '/shipping/carriers' },
      { title: 'MENU.SHIPPING.LABELS', path: '/shipping/labels' },
    ],
  },
  {
    title: 'MENU.MESSAGES',
    icon: MessageSquare,
    children: [
      { title: 'MENU.MESSAGES.INBOX', path: '/messages/inbox' },
      { title: 'MENU.MESSAGES.ASSISTANT', path: '/messages/assistant' },
      { title: 'MENU.MESSAGES.AUTO_REPLIES', path: '/messages/auto-replies' },
      { title: 'MENU.MESSAGES.WHATSAPP', path: '/messages/whatsapp' },
      { title: 'MENU.MESSAGES.EMAIL', path: '/messages/email' },
    ],
  },
];

export const MENU_SIDEBAR_CUSTOM: MenuConfig = [
  {
    title: 'Store - Client',
    icon: Users,
    children: [
      { title: 'Home', path: '/store-client/home' },
      {
        title: 'Search Results',
        children: [
          {
            title: 'Search Results - Grid',
            path: '/store-client/search-results-grid',
          },
          {
            title: 'Search Results - List',
            path: '/store-client/search-results-list',
          },
        ],
      },
      {
        title: 'Overlays',
        children: [
          { title: 'Product Details', path: '/store-client/product-details' },
          { title: 'Wishlist', path: '/store-client/wishlist' },
        ],
      },
      {
        title: 'Checkout',
        children: [
          {
            title: 'Order Summary',
            path: '/store-client/checkout/order-summary',
          },
          {
            title: 'Shipping Info',
            path: '/store-client/checkout/shipping-info',
          },
          {
            title: 'Payment Method',
            path: '/store-client/checkout/payment-method',
          },
          {
            title: 'Order Placed',
            path: '/store-client/checkout/order-placed',
          },
        ],
      },
      { title: 'My Orders', path: '/store-client/my-orders' },
      { title: 'Order Receipt', path: '/store-client/order-receipt' },
    ],
  },
];

export const MENU_SIDEBAR_COMPACT: MenuConfig = [
  {
    title: 'Dashboards',
    icon: LayoutGrid,
    path: '/',
  },
  {
    title: 'Public Profile',
    icon: UserCircle,
    children: [
      {
        title: 'Profiles',
        children: [
          { title: 'Default', path: '/public-profile/profiles/default' },
          { title: 'Creator', path: '/public-profile/profiles/creator' },
          { title: 'Company', path: '/public-profile/profiles/company' },
          { title: 'NFT', path: '/public-profile/profiles/nft' },
          { title: 'Blogger', path: '/public-profile/profiles/blogger' },
          { title: 'CRM', path: '/public-profile/profiles/crm' },
          {
            title: 'More',
            collapse: true,
            collapseTitle: 'Show less',
            expandTitle: 'Show 4 more',
            children: [
              { title: 'Gamer', path: '/public-profile/profiles/gamer' },
              { title: 'Feeds', path: '/public-profile/profiles/feeds' },
              { title: 'Plain', path: '/public-profile/profiles/plain' },
              { title: 'Modal', path: '/public-profile/profiles/modal' },
            ],
          },
        ],
      },
      {
        title: 'Projects',
        children: [
          { title: '3 Columns', path: '/public-profile/projects/3-columns' },
          { title: '2 Columns', path: '/public-profile/projects/2-columns' },
        ],
      },
      { title: 'Works', path: '/public-profile/works' },
      { title: 'Teams', path: '/public-profile/teams' },
      { title: 'Network', path: '/public-profile/network' },
      { title: 'Activity', path: '/public-profile/activity' },
      {
        title: 'More',
        collapse: true,
        collapseTitle: 'Show less',
        expandTitle: 'Show 3 more',
        children: [
          { title: 'Campaigns - Card', path: '/public-profile/campaigns/card' },
          { title: 'Campaigns - List', path: '/public-profile/campaigns/list' },
          { title: 'Empty', path: '/public-profile/empty' },
        ],
      },
    ],
  },
  {
    title: 'My Account',
    icon: Settings,
    children: [
      {
        title: 'Account',
        children: [
          { title: 'Get Started', path: '/account/home/get-started' },
          { title: 'User Profile', path: '/account/home/user-profile' },
          { title: 'Company Profile', path: '/account/home/company-profile' },
          {
            title: 'Settings - With Sidebar',
            path: '/account/home/settings-sidebar',
          },
          {
            title: 'Settings - Enterprise',
            path: '/account/home/settings-enterprise',
          },
          { title: 'Settings - Plain', path: '/account/home/settings-plain' },
          { title: 'Settings - Modal', path: '/account/home/settings-modal' },
        ],
      },
      {
        title: 'Billing',
        children: [
          { title: 'Billing - Basic', path: '/account/billing/basic' },
          {
            title: 'Billing - Enterprise',
            path: '/account/billing/enterprise',
          },
          { title: 'Plans', path: '/account/billing/plans' },
          { title: 'Billing History', path: '/account/billing/history' },
        ],
      },
      {
        title: 'Security',
        children: [
          { title: 'Get Started', path: '/account/security/get-started' },
          { title: 'Security Overview', path: '/account/security/overview' },
          {
            title: 'Allowed IP Addresses',
            path: '/account/security/allowed-ip-addresses',
          },
          {
            title: 'Privacy Settings',
            path: '/account/security/privacy-settings',
          },
          {
            title: 'Device Management',
            path: '/account/security/device-management',
          },
          {
            title: 'Backup & Recovery',
            path: '/account/security/backup-and-recovery',
          },
          {
            title: 'Current Sessions',
            path: '/account/security/current-sessions',
          },
          { title: 'Security Log', path: '/account/security/security-log' },
        ],
      },
      {
        title: 'Members & Roles',
        children: [
          { title: 'Teams Starter', path: '/account/members/team-starter' },
          { title: 'Teams', path: '/account/members/teams' },
          { title: 'Team Info', path: '/account/members/team-info' },
          {
            title: 'Members Starter',
            path: '/account/members/members-starter',
          },
          { title: 'Team Members', path: '/account/members/team-members' },
          { title: 'Import Members', path: '/account/members/import-members' },
          { title: 'Roles', path: '/account/members/roles' },
          {
            title: 'Permissions - Toggler',
            path: '/account/members/permissions-toggle',
          },
          {
            title: 'Permissions - Check',
            path: '/account/members/permissions-check',
          },
        ],
      },
      { title: 'Integrations', path: '/account/integrations' },
      { title: 'Notifications', path: '/account/notifications' },
      { title: 'API Keys', path: '/account/api-keys' },
      {
        title: 'More',
        collapse: true,
        collapseTitle: 'Show less',
        expandTitle: 'Show 3 more',
        children: [
          { title: 'Appearance', path: '/account/appearance' },
          { title: 'Invite a Friend', path: '/account/invite-a-friend' },
          { title: 'Activity', path: '/account/activity' },
        ],
      },
    ],
  },
  {
    title: 'Network',
    icon: Users,
    children: [
      { title: 'Get Started', path: '/network/get-started' },
      {
        title: 'User Cards',
        children: [
          { title: 'Mini Cards', path: '/network/user-cards/mini-cards' },
          { title: 'Team Crew', path: '/network/user-cards/team-crew' },
          { title: 'Author', path: '/network/user-cards/author' },
          { title: 'NFT', path: '/network/user-cards/nft' },
          { title: 'Social', path: '/network/user-cards/social' },
        ],
      },
      {
        title: 'User Table',
        children: [
          { title: 'Team Crew', path: '/network/user-table/team-crew' },
          { title: 'App Roster', path: '/network/user-table/app-roster' },
          {
            title: 'Market Authors',
            path: '/network/user-table/market-authors',
          },
          { title: 'SaaS Users', path: '/network/user-table/saas-users' },
          { title: 'Store Clients', path: '/network/user-table/store-clients' },
          { title: 'Visitors', path: '/network/user-table/visitors' },
        ],
      },
      { title: 'Cooperations', path: '/network/cooperations', disabled: true },
      { title: 'Leads', path: '/network/leads', disabled: true },
      { title: 'Donators', path: '/network/donators', disabled: true },
    ],
  },
  {
    title: 'Store - Client',
    icon: ShoppingCart,
    children: [
      { title: 'Home', path: '/store-client/home' },
      {
        title: 'Search Results - Grid',
        path: '/store-client/search-results-grid',
      },
      {
        title: 'Search Results - List',
        path: '/store-client/search-results-list',
      },
      { title: 'Product Details', path: '/store-client/product-details' },
      { title: 'Wishlist', path: '/store-client/wishlist' },
      {
        title: 'Checkout',
        children: [
          {
            title: 'Order Summary',
            path: '/store-client/checkout/order-summary',
          },
          {
            title: 'Shipping Info',
            path: '/store-client/checkout/shipping-info',
          },
          {
            title: 'Payment Method',
            path: '/store-client/checkout/payment-method',
          },
          {
            title: 'Order Placed',
            path: '/store-client/checkout/order-placed',
          },
        ],
      },
      { title: 'My Orders', path: '/store-client/my-orders' },
      { title: 'Order Receipt', path: '/store-client/order-receipt' },
    ],
  },
  {
    title: 'Authentication',
    icon: Shield,
    children: [
      {
        title: 'Classic',
        children: [
          { title: 'Sign In', path: '/auth/classic/signin' },
          { title: 'Sign Up', path: '/auth/classic/signup' },
          { title: '2FA', path: '/auth/classic/2fa' },
          { title: 'Check Email', path: '/auth/classic/check-email' },
          {
            title: 'Reset Password',
            children: [
              {
                title: 'Enter Email',
                path: '/auth/classic/request-reset',
              },
              {
                title: 'Check Email',
                path: '/auth/classic/reset-password/check-email',
              },
              {
                title: 'Password Changed',
                path: '/auth/classic/reset-password/changed',
              },
            ],
          },
        ],
      },
      {
        title: 'Branded',
        children: [
          { title: 'Sign In', path: '/auth/signin' },
          { title: 'Sign Up', path: '/auth/signup' },
          { title: '2FA', path: '/auth/2fa' },
          { title: 'Check Email', path: '/auth/check-email' },
          {
            title: 'Reset Password',
            children: [
              {
                title: 'Enter Email',
                path: '/auth/request-reset',
              },
              {
                title: 'Check Email',
                path: '/auth/reset-password/check-email',
              },
              {
                title: 'Password Changed',
                path: '/auth/reset-password/changed',
              },
            ],
          },
        ],
      },
      { title: 'Welcome Message', path: '/auth/welcome-message' },
      { title: 'Account Deactivated', path: '/auth/account-deactivated' },
      { title: 'Error 404', path: '/error/404' },
      { title: 'Error 500', path: '/error/500' },
    ],
  },
];

export const MENU_MEGA: MenuConfig = [
  { title: 'Home', path: '/' },
  {
    title: 'Profiles',
    children: [
      {
        title: 'Profiles',
        children: [
          {
            children: [
              {
                title: 'Default',
                icon: Badge,
                path: '/public-profile/profiles/default',
              },
              {
                title: 'Creator',
                icon: Coffee,
                path: '/public-profile/profiles/creator',
              },
              {
                title: 'Company',
                icon: Building,
                path: '/public-profile/profiles/company',
              },
              {
                title: 'NFT',
                icon: Bitcoin,
                path: '/public-profile/profiles/nft',
              },
              {
                title: 'Blogger',
                icon: MessageSquare,
                path: '/public-profile/profiles/blogger',
              },
              {
                title: 'CRM',
                icon: Monitor,
                path: '/public-profile/profiles/crm',
              },
              {
                title: 'Gamer',
                icon: Ghost,
                path: '/public-profile/profiles/gamer',
              },
            ],
          },
          {
            children: [
              {
                title: 'Feeds',
                icon: Book,
                path: '/public-profile/profiles/feeds',
              },
              {
                title: 'Plain',
                icon: File,
                path: '/public-profile/profiles/plain',
              },
              {
                title: 'Modal',
                icon: SquareMousePointer,
                path: '/public-profile/profiles/modal',
              },
              {
                title: 'Freelancer',
                icon: Briefcase,
                path: '#',
                disabled: true,
              },
              { title: 'Developer', icon: Code, path: '#', disabled: true },
              { title: 'Team', icon: Users, path: '#', disabled: true },
              {
                title: 'Events',
                icon: CalendarCheck,
                path: '#',
                disabled: true,
              },
            ],
          },
        ],
      },
      {
        title: 'Other Pages',
        children: [
          {
            children: [
              {
                title: 'Projects - 3 Cols',
                icon: Layout,
                path: '/public-profile/projects/3-columns',
              },
              {
                title: 'Projects - 2 Cols',
                icon: Grid,
                path: '/public-profile/projects/2-columns',
              },
              { title: 'Works', icon: WorkIcon, path: '/public-profile/works' },
              {
                title: 'Teams',
                icon: PeopleIcon,
                path: '/public-profile/teams',
              },
              {
                title: 'Network',
                icon: Network,
                path: '/public-profile/network',
              },
              {
                title: 'Activity',
                icon: TrendingUp,
                path: '/public-profile/activity',
              },
              {
                title: 'Campaigns - Card',
                icon: LayoutGrid,
                path: '/public-profile/campaigns/card',
              },
            ],
          },
          {
            children: [
              {
                title: 'Campaigns - List',
                icon: Kanban,
                path: '/public-profile/campaigns/list',
              },
              { title: 'Empty', icon: FileText, path: '/public-profile/empty' },
              {
                title: 'Documents',
                icon: DocumentIcon,
                path: '#',
                disabled: true,
              },
              { title: 'Badges', icon: Award, path: '#', disabled: true },
              { title: 'Awards', icon: Gift, path: '#', disabled: true },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'My Account',
    children: [
      {
        title: 'General Pages',
        children: [
          { title: 'Integrations', icon: Plug, path: '/account/integrations' },
          {
            title: 'Notifications',
            icon: Bell,
            path: '/account/notifications',
          },
          { title: 'API Keys', icon: Key, path: '/account/api-keys' },
          { title: 'Appearance', icon: Eye, path: '/account/appearance' },
          {
            title: 'Invite a Friend',
            icon: UserCheck,
            path: '/account/invite-a-friend',
          },
          { title: 'Activity', icon: LifeBuoy, path: '/account/activity' },
          { title: 'Brand', icon: CheckCircle, disabled: true },
          { title: 'Get Paid', icon: Euro, disabled: true },
        ],
      },
      {
        title: 'Other pages',
        children: [
          {
            title: 'Account Home',
            children: [
              { title: 'Get Started', path: '/account/home/get-started' },
              { title: 'User Profile', path: '/account/home/user-profile' },
              {
                title: 'Company Profile',
                path: '/account/home/company-profile',
              },
              { title: 'With Sidebar', path: '/account/home/settings-sidebar' },
              {
                title: 'Enterprise',
                path: '/account/home/settings-enterprise',
              },
              { title: 'Plain', path: '/account/home/settings-plain' },
              { title: 'Modal', path: '/account/home/settings-modal' },
            ],
          },
          {
            title: 'Billing',
            children: [
              { title: 'Basic Billing', path: '/account/billing/basic' },
              { title: 'Enterprise', path: '/account/billing/enterprise' },
              { title: 'Plans', path: '/account/billing/plans' },
              { title: 'Billing History', path: '/account/billing/history' },
              { title: 'Tax Info', disabled: true },
              { title: 'Invoices', disabled: true },
              { title: 'Gateaways', disabled: true },
            ],
          },
          {
            title: 'Security',
            children: [
              { title: 'Get Started', path: '/account/security/get-started' },
              {
                title: 'Security Overview',
                path: '/account/security/overview',
              },
              {
                title: 'IP Addresses',
                path: '/account/security/allowed-ip-addresses',
              },
              {
                title: 'Privacy Settings',
                path: '/account/security/privacy-settings',
              },
              {
                title: 'Device Management',
                path: '/account/security/device-management',
              },
              {
                title: 'Backup & Recovery',
                path: '/account/security/backup-and-recovery',
              },
              {
                title: 'Current Sessions',
                path: '/account/security/current-sessions',
              },
              { title: 'Security Log', path: '/account/security/security-log' },
            ],
          },
          {
            title: 'Members & Roles',
            children: [
              { title: 'Teams Starter', path: '/account/members/team-starter' },
              { title: 'Teams', path: '/account/members/teams' },
              { title: 'Team Info', path: '/account/members/team-info' },
              {
                title: 'Members Starter',
                path: '/account/members/members-starter',
              },
              { title: 'Team Members', path: '/account/members/team-members' },
              {
                title: 'Import Members',
                path: '/account/members/import-members',
              },
              { title: 'Roles', path: '/account/members/roles' },
              {
                title: 'Permissions - Toggler',
                path: '/account/members/permissions-toggle',
              },
              {
                title: 'Permissions - Check',
                path: '/account/members/permissions-check',
              },
            ],
          },
          {
            title: 'Other Pages',
            children: [
              { title: 'Integrations', path: '/account/integrations' },
              { title: 'Notifications', path: '/account/notifications' },
              { title: 'API Keys', path: '/account/api-keys' },
              { title: 'Appearance', path: '/account/appearance' },
              { title: 'Invite a Friend', path: '/account/invite-a-friend' },
              { title: 'Activity', path: '/account/activity' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Network',
    children: [
      {
        title: 'General Pages',
        children: [
          { title: 'Get Started', icon: Flag, path: '/network/get-started' },
          { title: 'Colleagues', icon: Users, path: '#', disabled: true },
          { title: 'Donators', icon: Heart, path: '#', disabled: true },
          { title: 'Leads', icon: Zap, path: '#', disabled: true },
        ],
      },
      {
        title: 'Other pages',
        children: [
          {
            title: 'User Cards',
            children: [
              { title: 'Mini Cards', path: '/network/user-cards/mini-cards' },
              { title: 'Team Members', path: '/network/user-cards/team-crew' },
              { title: 'Authors', path: '/network/user-cards/author' },
              { title: 'NFT Users', path: '/network/user-cards/nft' },
              { title: 'Social Users', path: '/network/user-cards/social' },
              { title: 'Gamers', path: '#', disabled: true },
            ],
          },
          {
            title: 'User Base',
            badge: 'Datatables',
            children: [
              { title: 'Team Crew', path: '/network/user-table/team-crew' },
              { title: 'App Roster', path: '/network/user-table/app-roster' },
              {
                title: 'Market Authors',
                path: '/network/user-table/market-authors',
              },
              { title: 'SaaS Users', path: '/network/user-table/saas-users' },
              {
                title: 'Store Clients',
                path: '/network/user-table/store-clients',
              },
              { title: 'Visitors', path: '/network/user-table/visitors' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Authentication',
    children: [
      {
        title: 'General pages',
        children: [
          {
            title: 'Classic Layout',
            children: [
              { title: 'Sign In', path: '/auth/classic/signin' },
              { title: 'Sign Up', path: '/auth/classic/signup' },
              { title: '2FA', path: '/auth/classic/2fa' },
              { title: 'Check Email', path: '/auth/classic/check-email' },
              {
                title: 'Reset Password',
                children: [
                  {
                    title: 'Enter Email',
                    path: '/auth/classic/reset-password',
                  },
                  {
                    title: 'Check Email',
                    path: '/auth/classic/reset-password/check-email',
                  },
                  {
                    title: 'Password is Changed',
                    path: '/auth/classic/reset-password/changed',
                  },
                ],
              },
            ],
          },
          {
            title: 'Branded Layout',
            children: [
              { title: 'Sign In', path: '/auth/signin' },
              { title: 'Sign Up', path: '/auth/signup' },
              { title: '2FA', path: '/auth/2fa' },
              { title: 'Check Email', path: '/auth/check-email' },
              {
                title: 'Reset Password',
                children: [
                  {
                    title: 'Enter Email',
                    path: '/auth/reset-password',
                  },
                  {
                    title: 'Check Email',
                    path: '/auth/reset-password/check-email',
                  },
                  {
                    title: 'Password is Changed',
                    path: '/auth/reset-password/changed',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Other Pages',
        children: [
          {
            title: 'Welcome Message',
            icon: ThumbsUp,
            path: '/auth/welcome-message',
          },
          {
            title: 'Account Deactivated',
            icon: ShieldOff,
            path: '/auth/account-deactivated',
          },
          { title: 'Error 404', icon: HelpCircle, path: '/error/404' },
          { title: 'Error 500', icon: AlertCircle, path: '/error/500' },
        ],
      },
    ],
  },
  {
    title: 'Store ',
    children: [
      {
        title: 'Store - Client',
        children: [
          {
            children: [
              { title: 'Home', path: '/store-client/home' },
              {
                title: 'Search Results - Grid',
                path: '/store-client/search-results-grid',
              },
              {
                title: 'Search Results - List',
                path: '/store-client/search-results-list',
              },
              {
                title: 'Product Details',
                path: '/store-client/product-details',
              },
              { title: 'Wishlist', path: '/store-client/wishlist' },
              { title: 'My Orders', path: '/store-client/my-orders' },
            ],
          },
          {
            children: [
              {
                title: 'Checkout - Order Summary',
                path: '/store-client/checkout/order-summary',
              },
              {
                title: 'Checkout - Shipping Info',
                path: '/store-client/checkout/shipping-info',
              },
              {
                title: 'Checkout - Payment Method',
                path: '/store-client/checkout/payment-method',
              },
              {
                title: 'Checkout - Order Placed',
                path: '/store-client/checkout/order-placed',
              },
              { title: 'Order Receipt', path: '/store-client/order-receipt' },
            ],
          },
        ],
      },
    ],
  },
];

export const MENU_MEGA_MOBILE: MenuConfig = [
  { title: 'Home', path: '/' },
  {
    title: 'Profiles',
    children: [
      {
        title: 'Profiles',
        children: [
          {
            title: 'Default',
            icon: Badge,
            path: '/public-profile/profiles/default',
          },
          {
            title: 'Creator',
            icon: Coffee,
            path: '/public-profile/profiles/creator',
          },
          {
            title: 'Company',
            icon: Building,
            path: '/public-profile/profiles/company',
          },
          { title: 'NFT', icon: Bitcoin, path: '/public-profile/profiles/nft' },
          {
            title: 'Blogger',
            icon: MessageSquare,
            path: '/public-profile/profiles/blogger',
          },
          { title: 'CRM', icon: Monitor, path: '/public-profile/profiles/crm' },
          {
            title: 'Gamer',
            icon: Ghost,
            path: '/public-profile/profiles/gamer',
          },
          {
            title: 'Feeds',
            icon: Book,
            path: '/public-profile/profiles/feeds',
          },
          {
            title: 'Plain',
            icon: File,
            path: '/public-profile/profiles/plain',
          },
          {
            title: 'Modal',
            icon: SquareMousePointer,
            path: '/public-profile/profiles/modal',
          },
          { title: 'Freelancer', icon: Briefcase, path: '#', disabled: true },
          { title: 'Developer', icon: Code, path: '#', disabled: true },
          { title: 'Team', icon: Users, path: '#', disabled: true },
          { title: 'Events', icon: CalendarCheck, path: '#', disabled: true },
        ],
      },
      {
        title: 'Other Pages',
        children: [
          {
            title: 'Projects - 3 Cols',
            icon: Layout,
            path: '/public-profile/projects/3-columns',
          },
          {
            title: 'Projects - 2 Cols',
            icon: Grid,
            path: '/public-profile/projects/2-columns',
          },
          { title: 'Works', icon: WorkIcon, path: '/public-profile/works' },
          { title: 'Teams', icon: PeopleIcon, path: '/public-profile/teams' },
          { title: 'Network', icon: Network, path: '/public-profile/network' },
          {
            title: 'Activity',
            icon: TrendingUp,
            path: '/public-profile/activity',
          },
          {
            title: 'Campaigns - Card',
            icon: LayoutGrid,
            path: '/public-profile/campaigns/card',
          },
          {
            title: 'Campaigns - List',
            icon: Kanban,
            path: '/public-profile/campaigns/list',
          },
          { title: 'Empty', icon: FileText, path: '/public-profile/empty' },
          { title: 'Documents', icon: DocumentIcon, path: '#', disabled: true },
          { title: 'Badges', icon: Award, path: '#', disabled: true },
          { title: 'Awards', icon: Gift, path: '#', disabled: true },
        ],
      },
    ],
  },
  {
    title: 'My Account',
    children: [
      {
        title: 'General Pages',
        children: [
          { title: 'Integrations', icon: Plug, path: '/account/integrations' },
          {
            title: 'Notifications',
            icon: Bell,
            path: '/account/notifications',
          },
          { title: 'API Keys', icon: Key, path: '/account/api-keys' },
          { title: 'Appearance', icon: Eye, path: '/account/appearance' },
          {
            title: 'Invite a Friend',
            icon: UserCheck,
            path: '/account/invite-a-friend',
          },
          { title: 'Activity', icon: LifeBuoy, path: '/account/activity' },
          { title: 'Brand', icon: CheckCircle, disabled: true },
          { title: 'Get Paid', icon: Euro, disabled: true },
        ],
      },
      {
        title: 'Other pages',
        children: [
          {
            title: 'Account Home',
            children: [
              { title: 'Get Started', path: '/account/home/get-started' },
              { title: 'User Profile', path: '/account/home/user-profile' },
              {
                title: 'Company Profile',
                path: '/account/home/company-profile',
              },
              { title: 'With Sidebar', path: '/account/home/settings-sidebar' },
              {
                title: 'Enterprise',
                path: '/account/home/settings-enterprise',
              },
              { title: 'Plain', path: '/account/home/settings-plain' },
              { title: 'Modal', path: '/account/home/settings-modal' },
            ],
          },
          {
            title: 'Billing',
            children: [
              { title: 'Basic Billing', path: '/account/billing/basic' },
              { title: 'Enterprise', path: '/account/billing/enterprise' },
              { title: 'Plans', path: '/account/billing/plans' },
              { title: 'Billing History', path: '/account/billing/history' },
              { title: 'Tax Info', disabled: true },
              { title: 'Invoices', disabled: true },
              { title: 'Gateaways', disabled: true },
            ],
          },
          {
            title: 'Security',
            children: [
              { title: 'Get Started', path: '/account/security/get-started' },
              {
                title: 'Security Overview',
                path: '/account/security/overview',
              },
              {
                title: 'IP Addresses',
                path: '/account/security/allowed-ip-addresses',
              },
              {
                title: 'Privacy Settings',
                path: '/account/security/privacy-settings',
              },
              {
                title: 'Device Management',
                path: '/account/security/device-management',
              },
              {
                title: 'Backup & Recovery',
                path: '/account/security/backup-and-recovery',
              },
              {
                title: 'Current Sessions',
                path: '/account/security/current-sessions',
              },
              { title: 'Security Log', path: '/account/security/security-log' },
            ],
          },
          {
            title: 'Members & Roles',
            children: [
              { title: 'Teams Starter', path: '/account/members/team-starter' },
              { title: 'Teams', path: '/account/members/teams' },
              { title: 'Team Info', path: '/account/members/team-info' },
              {
                title: 'Members Starter',
                path: '/account/members/members-starter',
              },
              { title: 'Team Members', path: '/account/members/team-members' },
              {
                title: 'Import Members',
                path: '/account/members/import-members',
              },
              { title: 'Roles', path: '/account/members/roles' },
              {
                title: 'Permissions - Toggler',
                path: '/account/members/permissions-toggle',
              },
              {
                title: 'Permissions - Check',
                path: '/account/members/permissions-check',
              },
            ],
          },
          {
            title: 'Other Pages',
            children: [
              { title: 'Integrations', path: '/account/integrations' },
              { title: 'Notifications', path: '/account/notifications' },
              { title: 'API Keys', path: '/account/api-keys' },
              { title: 'Appearance', path: '/account/appearance' },
              { title: 'Invite a Friend', path: '/account/invite-a-friend' },
              { title: 'Activity', path: '/account/activity' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Network',
    children: [
      {
        title: 'General Pages',
        children: [
          { title: 'Get Started', icon: Flag, path: '/network/get-started' },
          { title: 'Colleagues', icon: Users, path: '#', disabled: true },
          { title: 'Donators', icon: Heart, path: '#', disabled: true },
          { title: 'Leads', icon: Zap, path: '#', disabled: true },
        ],
      },
      {
        title: 'Other pages',
        children: [
          {
            title: 'User Cards',
            children: [
              { title: 'Mini Cards', path: '/network/user-cards/mini-cards' },
              { title: 'Team Members', path: '/network/user-cards/team-crew' },
              { title: 'Authors', path: '/network/user-cards/author' },
              { title: 'NFT Users', path: '/network/user-cards/nft' },
              { title: 'Social Users', path: '/network/user-cards/social' },
              { title: 'Gamers', path: '#', disabled: true },
            ],
          },
          {
            title: 'User Base',
            badge: 'Datatables',
            children: [
              { title: 'Team Crew', path: '/network/user-table/team-crew' },
              { title: 'App Roster', path: '/network/user-table/app-roster' },
              {
                title: 'Market Authors',
                path: '/network/user-table/market-authors',
              },
              { title: 'SaaS Users', path: '/network/user-table/saas-users' },
              {
                title: 'Store Clients',
                path: '/network/user-table/store-clients',
              },
              { title: 'Visitors', path: '/network/user-table/visitors' },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Store - Client',
    children: [
      { title: 'Home', path: '/store-client/home' },
      {
        title: 'Search Results - Grid',
        path: '/store-client/search-results-grid',
      },
      {
        title: 'Search Results - List',
        path: '/store-client/search-results-list',
      },
      { title: 'Product Details', path: '/store-client/product-details' },
      { title: 'Wishlist', path: '/store-client/wishlist' },
      {
        title: 'Checkout',
        children: [
          {
            title: 'Order Summary',
            path: '/store-client/checkout/order-summary',
          },
          {
            title: 'Shipping Info',
            path: '/store-client/checkout/shipping-info',
          },
          {
            title: 'Payment Method',
            path: '/store-client/checkout/payment-method',
          },
          {
            title: 'Order Placed',
            path: '/store-client/checkout/order-placed',
          },
        ],
      },
      { title: 'My Orders', path: '/store-client/my-orders' },
      { title: 'Order Receipt', path: '/store-client/order-receipt' },
    ],
  },
  {
    title: 'Authentication',
    children: [
      {
        title: 'General pages',
        children: [
          {
            title: 'Classic Layout',
            children: [
              { title: 'Sign In', path: '/auth/classic/signin' },
              { title: 'Sign Up', path: '/auth/classic/signup' },
              { title: '2FA', path: '/auth/classic/2fa' },
              { title: 'Check Email', path: '/auth/classic/check-email' },
              {
                title: 'Reset Password',
                children: [
                  {
                    title: 'Enter Email',
                    path: '/auth/classic/request-reset',
                  },
                  {
                    title: 'Check Email',
                    path: '/auth/classic/reset-password/check-email',
                  },
                  {
                    title: 'Password is Changed',
                    path: '/auth/classic/reset-password/changed',
                  },
                ],
              },
            ],
          },
          {
            title: 'Branded Layout',
            children: [
              { title: 'Sign In', path: '/auth/signin' },
              { title: 'Sign Up', path: '/auth/signup' },
              { title: '2FA', path: '/auth/2fa' },
              { title: 'Check Email', path: '/auth/check-email' },
              {
                title: 'Reset Password',
                children: [
                  {
                    title: 'Enter Email',
                    path: '/auth/request-reset',
                  },
                  {
                    title: 'Check Email',
                    path: '/auth/reset-password/check-email',
                  },
                  {
                    title: 'Password is Changed',
                    path: '/auth/reset-password/changed',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Other Pages',
        children: [
          {
            title: 'Welcome Message',
            icon: ThumbsUp,
            path: '/auth/welcome-message',
          },
          {
            title: 'Account Deactivated',
            icon: ShieldOff,
            path: '/auth/account-deactivated',
          },
          { title: 'Error 404', icon: HelpCircle, path: '/error/404' },
          { title: 'Error 500', icon: AlertCircle, path: '/error/500' },
        ],
      },
    ],
  },
  {
    title: 'Help',
    children: [
      {
        title: 'Getting Started',
        icon: Coffee,
        path: 'https://keenthemes.com/metronic/tailwind/docs/getting-started/installation',
      },
      {
        title: 'Support Forum',
        icon: AlertCircle,
        children: [
          {
            title: 'All Questions',
            icon: FileQuestion,
            path: 'https://devs.keenthemes.com',
          },
          {
            title: 'Popular Questions',
            icon: Star,
            path: 'https://devs.keenthemes.com/popular',
          },
          {
            title: 'Ask Question',
            icon: HelpCircle,
            path: 'https://devs.keenthemes.com/question/create',
          },
        ],
      },
      {
        title: 'Licenses & FAQ',
        icon: Captions,
        path: 'https://keenthemes.com/metronic/tailwind/docs/getting-started/license',
      },
      {
        title: 'Documentation',
        icon: FileQuestion,
        path: 'https://keenthemes.com/metronic/tailwind/docs',
      },
      { separator: true },
      {
        title: 'Contact Us',
        icon: Share2,
        path: 'https://keenthemes.com/contact',
      },
    ],
  },
];

export const MENU_HELP: MenuConfig = [
  {
    title: 'Getting Started',
    icon: Coffee,
    path: 'https://keenthemes.com/metronic/tailwind/docs/getting-started/installation',
  },
  {
    title: 'Support Forum',
    icon: AlertCircle,
    children: [
      {
        title: 'All Questions',
        icon: FileQuestion,
        path: 'https://devs.keenthemes.com',
      },
      {
        title: 'Popular Questions',
        icon: Star,
        path: 'https://devs.keenthemes.com/popular',
      },
      {
        title: 'Ask Question',
        icon: HelpCircle,
        path: 'https://devs.keenthemes.com/question/create',
      },
    ],
  },
  {
    title: 'Licenses & FAQ',
    icon: Captions,
    path: 'https://keenthemes.com/metronic/tailwind/docs/getting-started/license',
  },
  {
    title: 'Documentation',
    icon: FileQuestion,
    path: 'https://keenthemes.com/metronic/tailwind/docs',
  },
  { separator: true },
  { title: 'Contact Us', icon: Share2, path: 'https://keenthemes.com/contact' },
];

export const MENU_ROOT: MenuConfig = [
  {
    title: 'Public Profile',
    icon: UserCircle,
    rootPath: '/public-profile/',
    path: 'public-profile/profiles/default',
    childrenIndex: 2,
  },
  {
    title: 'Account',
    icon: Settings,
    rootPath: '/account/',
    path: '/',
    childrenIndex: 3,
  },
  {
    title: 'Network',
    icon: Users,
    rootPath: '/network/',
    path: 'network/get-started',
    childrenIndex: 4,
  },
  {
    title: 'Store - Client',
    icon: ShoppingCart,
    rootPath: '/store-client/',
    path: 'store-client/home',
    childrenIndex: 4,
  },
  {
    title: 'Authentication',
    icon: Shield,
    rootPath: '/authentication/',
    path: 'authentication/get-started',
    childrenIndex: 5,
  },
];
