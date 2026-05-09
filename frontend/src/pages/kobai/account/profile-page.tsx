import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CameraIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'sonner';
import { Container } from '@/components/common/container';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { ApiError, apiRequest } from '@/lib/api-client';
import { DefinitionList } from '../components/definition-list';

interface BackendUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  avatar_key: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface PresignedUploadResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
  public_url: string;
  expires_in: number;
  max_size: number;
}

interface UpdateMePayload {
  full_name?: string | null;
  avatar_key?: string | null;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

const formatDate = (iso: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const initialsOf = (user: BackendUser): string => {
  const source = (user.full_name || user.username || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function ProfilePage() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<BackendUser>('/users/me'),
    staleTime: 30_000,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (data && !isEditing) {
      setFullName(data.full_name ?? '');
    }
  }, [data, isEditing]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMePayload) =>
      apiRequest<BackendUser>('/users/me', {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const presigned = await apiRequest<PresignedUploadResponse>(
        '/uploads/presigned',
        {
          method: 'POST',
          body: {
            filename: file.name,
            content_type: file.type || 'application/octet-stream',
            prefix: 'avatars',
          },
        },
      );

      const formData = new FormData();
      Object.entries(presigned.fields).forEach(([k, v]) => {
        formData.append(k, v);
      });
      formData.append('file', file);

      const uploadRes = await fetch(presigned.url, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status})`);
      }

      return apiRequest<BackendUser>('/users/me', {
        method: 'PATCH',
        body: { avatar_key: presigned.key },
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success(
        intl.formatMessage({ id: 'ACCOUNT.PROFILE.SAVE_SUCCESS' }),
      );
    },
    onError: (err) => {
      const detail =
        err instanceof ApiError
          ? err.message
          : intl.formatMessage({ id: 'ACCOUNT.PROFILE.AVATAR_UPLOAD_ERROR' });
      toast.error(detail);
    },
  });

  const handleAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error(intl.formatMessage({ id: 'ACCOUNT.PROFILE.AVATAR_INVALID' }));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(
        intl.formatMessage({ id: 'ACCOUNT.PROFILE.AVATAR_TOO_LARGE' }),
      );
      return;
    }

    avatarMutation.mutate(file);
  };

  const handleRemoveAvatar = () => {
    updateMutation.mutate(
      { avatar_key: null },
      {
        onSuccess: () =>
          toast.success(
            intl.formatMessage({ id: 'ACCOUNT.PROFILE.SAVE_SUCCESS' }),
          ),
        onError: (err) => {
          const detail =
            err instanceof ApiError
              ? err.message
              : intl.formatMessage({ id: 'ACCOUNT.PROFILE.SAVE_ERROR' });
          toast.error(detail);
        },
      },
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    const trimmed = fullName.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    if ((data.full_name ?? null) === next) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(
      { full_name: next },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success(
            intl.formatMessage({ id: 'ACCOUNT.PROFILE.SAVE_SUCCESS' }),
          );
        },
        onError: (err) => {
          const detail =
            err instanceof ApiError
              ? err.message
              : intl.formatMessage({ id: 'ACCOUNT.PROFILE.SAVE_ERROR' });
          toast.error(detail);
        },
      },
    );
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFullName(data?.full_name ?? '');
  };

  const notSet = intl.formatMessage({ id: 'ACCOUNT.PROFILE.NOT_SET' });
  const isUploading = avatarMutation.isPending;
  const isSaving = updateMutation.isPending;

  return (
    <>
      <Container>
        {isLoading && (
          <Card>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              <FormattedMessage id="COMMON.LOADING" />
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive" appearance="light">
            <AlertIcon />
            <AlertTitle>
              <FormattedMessage id="ACCOUNT.PROFILE.LOAD_ERROR" />
            </AlertTitle>
          </Alert>
        )}

        {data && !isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-1">
              <CardContent className="flex flex-col items-center gap-4 pt-6">
                <div className="relative">
                  <Avatar className="size-28">
                    {data.avatar_url ? (
                      <AvatarImage
                        src={data.avatar_url}
                        alt={data.full_name || data.username}
                      />
                    ) : null}
                    <AvatarFallback className="text-2xl">
                      {initialsOf(data)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSaving}
                    className="absolute bottom-0 end-0 inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background transition hover:bg-primary/90 disabled:opacity-60"
                    aria-label={intl.formatMessage({
                      id: 'ACCOUNT.PROFILE.AVATAR_UPLOAD',
                    })}
                  >
                    {isUploading ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : (
                      <CameraIcon className="size-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_AVATAR_TYPES.join(',')}
                    className="hidden"
                    onChange={handleAvatarPick}
                  />
                </div>

                <div className="text-center">
                  <div className="text-base font-semibold text-mono">
                    {data.full_name || data.username}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {data.email}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSaving}
                  >
                    {isUploading ? (
                      <FormattedMessage id="ACCOUNT.PROFILE.AVATAR_UPLOADING" />
                    ) : (
                      <FormattedMessage id="ACCOUNT.PROFILE.AVATAR_UPLOAD" />
                    )}
                  </Button>
                  {data.avatar_key && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={isUploading || isSaving}
                    >
                      <Trash2Icon className="size-4" />
                      <FormattedMessage id="ACCOUNT.PROFILE.AVATAR_REMOVE" />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  <FormattedMessage id="ACCOUNT.PROFILE.AVATAR_HINT" />
                </p>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 grid grid-cols-1 gap-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>
                      <FormattedMessage id="ACCOUNT.PROFILE.SECTION_PROFILE" />
                    </CardTitle>
                  </div>
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <PencilIcon className="size-4" />
                      <FormattedMessage id="ACCOUNT.PROFILE.EDIT" />
                    </Button>
                  )}
                </CardHeader>

                {isEditing ? (
                  <form onSubmit={handleSaveProfile}>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label>
                            <FormattedMessage id="ACCOUNT.PROFILE.FULL_NAME" />
                          </Label>
                          <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder={intl.formatMessage({
                              id: 'ACCOUNT.PROFILE.FULL_NAME_PLACEHOLDER',
                            })}
                            maxLength={120}
                            autoFocus
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>
                            <FormattedMessage id="ACCOUNT.PROFILE.USERNAME" />
                          </Label>
                          <Input value={data.username} disabled readOnly />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>
                            <FormattedMessage id="ACCOUNT.PROFILE.EMAIL" />
                          </Label>
                          <Input value={data.email} disabled readOnly />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <FormattedMessage id="ACCOUNT.PROFILE.CANCEL" />
                      </Button>
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && (
                          <LoaderCircleIcon className="size-4 animate-spin" />
                        )}
                        <FormattedMessage id="ACCOUNT.PROFILE.SAVE" />
                      </Button>
                    </CardFooter>
                  </form>
                ) : (
                  <CardContent>
                    <DefinitionList
                      items={[
                        {
                          label: (
                            <FormattedMessage id="ACCOUNT.PROFILE.FULL_NAME" />
                          ),
                          value: data.full_name || (
                            <span className="text-muted-foreground">
                              {notSet}
                            </span>
                          ),
                        },
                        {
                          label: (
                            <FormattedMessage id="ACCOUNT.PROFILE.USERNAME" />
                          ),
                          value: data.username,
                        },
                        {
                          label: (
                            <FormattedMessage id="ACCOUNT.PROFILE.EMAIL" />
                          ),
                          value: data.email,
                        },
                        {
                          label: (
                            <FormattedMessage id="ACCOUNT.PROFILE.ROLE" />
                          ),
                          value: (
                            <Badge
                              variant={
                                data.role === 'admin' ? 'primary' : 'secondary'
                              }
                              appearance="light"
                            >
                              <FormattedMessage
                                id={
                                  data.role === 'admin'
                                    ? 'ACCOUNT.PROFILE.ROLE_ADMIN'
                                    : 'ACCOUNT.PROFILE.ROLE_USER'
                                }
                              />
                            </Badge>
                          ),
                        },
                      ]}
                    />
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <FormattedMessage id="ACCOUNT.PROFILE.SECTION_ACCOUNT" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DefinitionList
                    items={[
                      {
                        label: (
                          <FormattedMessage id="ACCOUNT.PROFILE.STATUS" />
                        ),
                        value: (
                          <Badge
                            variant={
                              data.is_active ? 'success' : 'destructive'
                            }
                            appearance="light"
                          >
                            <FormattedMessage
                              id={
                                data.is_active
                                  ? 'ACCOUNT.PROFILE.ACTIVE'
                                  : 'ACCOUNT.PROFILE.INACTIVE'
                              }
                            />
                          </Badge>
                        ),
                      },
                      {
                        label: (
                          <FormattedMessage id="ACCOUNT.PROFILE.CREATED_AT" />
                        ),
                        value: formatDate(data.created_at, intl.locale),
                      },
                      {
                        label: (
                          <FormattedMessage id="ACCOUNT.PROFILE.UPDATED_AT" />
                        ),
                        value: formatDate(data.updated_at, intl.locale),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
