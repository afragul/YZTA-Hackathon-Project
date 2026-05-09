import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { useAuth } from '@/auth/context/auth-context';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '../components/page-header';

const mask = (token: string) =>
  token.length <= 12
    ? '•'.repeat(token.length)
    : `${token.slice(0, 6)}…${token.slice(-4)}`;

export function ApiKeysPage() {
  const { auth } = useAuth();
  const [visible, setVisible] = useState(false);
  const token = auth?.access_token || '';

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.API_KEYS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.API_KEYS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <CardHeader>
            <CardTitle>
              <FormattedMessage id="SETTINGS.API_KEYS.TITLE" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <FormattedMessage id="SETTINGS.API_KEYS.NAME" />
                  </TableHead>
                  <TableHead>
                    <FormattedMessage id="SETTINGS.API_KEYS.KEY" />
                  </TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">
                    <FormattedMessage id="SETTINGS.API_KEYS.ACTIONS" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    <FormattedMessage id="SETTINGS.API_KEYS.SESSION" />
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {token
                      ? visible
                        ? token
                        : mask(token)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisible((v) => !v)}
                    >
                      {visible ? (
                        <>
                          <EyeOff className="size-3.5" />
                          <FormattedMessage id="SETTINGS.API_KEYS.HIDE" />
                        </>
                      ) : (
                        <>
                          <Eye className="size-3.5" />
                          <FormattedMessage id="SETTINGS.API_KEYS.SHOW" />
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
