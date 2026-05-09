import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '../components/page-header';

const STORAGE_KEY = 'kobai-general-settings';

interface GeneralSettings {
  businessName: string;
  contactEmail: string;
  phone: string;
  timezone: string;
  currency: string;
}

const defaults: GeneralSettings = {
  businessName: '',
  contactEmail: '',
  phone: '',
  timezone: 'Europe/Istanbul',
  currency: 'TRY',
};

const TIMEZONES = ['Europe/Istanbul', 'Europe/London', 'UTC'];
const CURRENCIES = ['TRY', 'USD', 'EUR'];

const loadSettings = (): GeneralSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<GeneralSettings>) };
  } catch {
    return defaults;
  }
};

export function GeneralSettingsPage() {
  const intl = useIntl();
  const [form, setForm] = useState<GeneralSettings>(loadSettings);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const update = (key: keyof GeneralSettings, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSavedAt(Date.now());
  };

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.GENERAL.TITLE" />}
        description={<FormattedMessage id="SETTINGS.GENERAL.SUBTITLE" />}
      />

      <Container>
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>
                <FormattedMessage id="SETTINGS.GENERAL.TITLE" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>
                    <FormattedMessage id="SETTINGS.GENERAL.BUSINESS_NAME" />
                  </Label>
                  <Input
                    value={form.businessName}
                    onChange={(e) => update('businessName', e.target.value)}
                    placeholder={intl.formatMessage({
                      id: 'SETTINGS.GENERAL.BUSINESS_NAME_PLACEHOLDER',
                    })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <FormattedMessage id="SETTINGS.GENERAL.CONTACT_EMAIL" />
                  </Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => update('contactEmail', e.target.value)}
                    placeholder="info@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <FormattedMessage id="SETTINGS.GENERAL.PHONE" />
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="+90 ..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <FormattedMessage id="SETTINGS.GENERAL.TIMEZONE" />
                  </Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => update('timezone', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    <FormattedMessage id="SETTINGS.GENERAL.CURRENCY" />
                  </Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => update('currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              {savedAt && (
                <span className="text-xs text-success me-2">
                  ✓ {new Date(savedAt).toLocaleTimeString(intl.locale)}
                </span>
              )}
              <Button type="submit">
                <FormattedMessage id="SETTINGS.SAVE" />
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Container>
    </>
  );
}
