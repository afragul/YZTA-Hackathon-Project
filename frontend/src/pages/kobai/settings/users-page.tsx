import { useQuery } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { Container } from '@/components/common/container';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { apiRequest } from '@/lib/api-client';
import { PageHeader } from '../components/page-header';

interface BackendUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
}

export function UsersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<BackendUser>('/users/me'),
    staleTime: 30_000,
  });

  const users: BackendUser[] = data ? [data] : [];

  return (
    <>
      <PageHeader
        title={<FormattedMessage id="SETTINGS.USERS.TITLE" />}
        description={<FormattedMessage id="SETTINGS.USERS.SUBTITLE" />}
      />

      <Container>
        <Card>
          <CardHeader>
            <CardTitle>
              <FormattedMessage id="SETTINGS.USERS.TITLE" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" />
                <FormattedMessage id="COMMON.LOADING" />
              </div>
            )}
            {isError && !isLoading && (
              <div className="p-5">
                <Alert variant="destructive" appearance="light">
                  <AlertIcon />
                  <AlertTitle>
                    <FormattedMessage id="SETTINGS.USERS.LOAD_ERROR" />
                  </AlertTitle>
                </Alert>
              </div>
            )}
            {!isLoading && !isError && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <FormattedMessage id="SETTINGS.USERS.NAME" />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage id="SETTINGS.USERS.USERNAME" />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage id="SETTINGS.USERS.EMAIL" />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage id="SETTINGS.USERS.ROLE" />
                    </TableHead>
                    <TableHead>
                      <FormattedMessage id="SETTINGS.USERS.STATUS" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name || '—'}
                      </TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === 'admin' ? 'primary' : 'secondary'}
                          appearance="light"
                        >
                          <FormattedMessage
                            id={
                              u.role === 'admin'
                                ? 'ACCOUNT.PROFILE.ROLE_ADMIN'
                                : 'ACCOUNT.PROFILE.ROLE_USER'
                            }
                          />
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.is_active ? 'success' : 'destructive'}
                          appearance="light"
                        >
                          <FormattedMessage
                            id={
                              u.is_active
                                ? 'ACCOUNT.PROFILE.ACTIVE'
                                : 'ACCOUNT.PROFILE.INACTIVE'
                            }
                          />
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
