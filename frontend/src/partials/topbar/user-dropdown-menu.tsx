import { ReactNode } from 'react';
import { useAuth } from '@/auth/context/auth-context';
import { I18N_LANGUAGES } from '@/i18n/config';
import { Language } from '@/i18n/types';
import { Globe, Moon, UserCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import { toAbsoluteUrl } from '@/lib/helpers';
import { useLanguage } from '@/providers/i18n-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

export function UserDropdownMenu({ trigger }: { trigger: ReactNode }) {
  const { logout, user } = useAuth();
  const { currenLanguage, changeLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const displayName =
    user?.fullname ||
    (user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.username || 'User');

  const displayEmail = user?.email || '';
  const displayAvatar = user?.pic || toAbsoluteUrl('/media/avatars/300-2.png');

  const handleLanguage = (lang: Language) => {
    changeLanguage(lang);
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" side="bottom" align="end">
        <div className="flex items-center gap-2 p-3">
          <img
            className="size-9 rounded-full border-2 border-green-500"
            src={displayAvatar}
            alt="User avatar"
          />
          <div className="flex flex-col">
            <span className="text-sm text-mono font-semibold">
              {displayName}
            </span>
            <a
              href={`mailto:${displayEmail}`}
              className="text-xs text-muted-foreground hover:text-primary"
            >
              {displayEmail}
            </a>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/account/profile" className="flex items-center gap-2">
            <UserCircle />
            <FormattedMessage id="USER.MENU.PROFILE" defaultMessage="Profile" />
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 [&_[data-slot=dropdown-menu-sub-trigger-indicator]]:hidden hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input">
            <Globe />
            <span className="flex items-center justify-between gap-2 grow relative">
              <FormattedMessage
                id="USER.MENU.LANGUAGE"
                defaultMessage="Language"
              />
              <Badge
                variant="outline"
                className="absolute end-0 top-1/2 -translate-y-1/2"
              >
                {currenLanguage.label}
                <img
                  src={currenLanguage.flag}
                  className="w-3.5 h-3.5 rounded-full"
                  alt={currenLanguage.label}
                />
              </Badge>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuRadioGroup
              value={currenLanguage.code}
              onValueChange={(value) => {
                const selectedLang = I18N_LANGUAGES.find(
                  (lang) => lang.code === value,
                );
                if (selectedLang) handleLanguage(selectedLang);
              }}
            >
              {I18N_LANGUAGES.map((item) => (
                <DropdownMenuRadioItem
                  key={item.code}
                  value={item.code}
                  className="flex items-center gap-2"
                >
                  <img
                    src={item.flag}
                    className="w-4 h-4 rounded-full"
                    alt={item.label}
                  />
                  <span>{item.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(event) => event.preventDefault()}
        >
          <Moon />
          <div className="flex items-center gap-2 justify-between grow">
            <FormattedMessage
              id="USER.MENU.DARK_MODE"
              defaultMessage="Dark Mode"
            />
            <Switch
              size="sm"
              checked={theme === 'dark'}
              onCheckedChange={handleThemeToggle}
            />
          </div>
        </DropdownMenuItem>
        <div className="p-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={logout}
          >
            <FormattedMessage id="USER.MENU.LOGOUT" defaultMessage="Logout" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
