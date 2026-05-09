import { Mail, MessageCircle, ShoppingBag } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { channels, type ChannelStat } from '../mock-data';
import { fmtPct, fmtTRY } from '../format';

const ICONS: Record<ChannelStat['id'], React.ComponentType<{ className?: string }>> = {
  trendyol: ShoppingBag,
  website: Mail,
  whatsapp: MessageCircle,
};

export function ChannelsCard() {
  const intl = useIntl();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <FormattedMessage id="DASHBOARD.CHANNELS.TITLE" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {channels.map((c) => {
            const Icon = ICONS[c.id];
            return (
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-lg border border-border p-4"
              >
                <div
                  className="size-10 rounded-md flex items-center justify-center text-white shrink-0"
                  style={{ background: c.color }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex flex-col grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-mono truncate">
                      {c.label}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      %{fmtPct(c.share, intl.locale)}
                    </span>
                  </div>
                  <span className="text-base font-semibold text-mono">
                    {fmtTRY(c.total, intl.locale)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
