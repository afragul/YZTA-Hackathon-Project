import { useTheme } from 'next-themes';
import { FormattedMessage } from 'react-intl';
import { I18N_LANGUAGES } from '@/i18n/config';
import { useLanguage } from '@/providers/i18n-provider';
import { Container } from '@/components/common/container';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '../components/page-header';

const THEMES = [
  { value: 'light', labelId: 'SETTINGS.APPEARANCE.THEME_LIGHT' },
  { value: 'dark', labelId: 'SETTINGS.APPEARANCE.THEME_DARK' },
  { value: 'system', labelId: 'SETTINGS.APPEARANCE.THEME_SYSTEM' },
] as const;

export function AppearanceSettingsPage() {
  const { theme = 'system', setTheme } = useTheme();
  const { currenLanguage, changeLanguage } = useLanguage();

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.APPEARANCE.TITLE" />}
        description={<FormattedMessage id="SETTINGS.APPEARANCE.SUBTITLE" />}
      />

      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>
                <FormattedMessage id="SETTINGS.APPEARANCE.THEME" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="flex flex-col gap-3"
              >
                {THEMES.map((t) => (
                  <Label
                    key={t.value}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <RadioGroupItem value={t.value} id={`theme-${t.value}`} />
                    <span className="text-sm">
                      <FormattedMessage id={t.labelId} />
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <FormattedMessage id="SETTINGS.APPEARANCE.LANGUAGE" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={currenLanguage.code}
                onValueChange={(v) => {
                  const lang = I18N_LANGUAGES.find((l) => l.code === v);
                  if (lang) changeLanguage(lang);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {I18N_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <img
                          src={lang.flag}
                          className="size-4 rounded-full"
                          alt={lang.label}
                        />
                        {lang.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </Container>
    </>
  );
}
