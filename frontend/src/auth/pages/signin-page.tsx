import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/context/auth-context';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  LoaderCircleIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toAbsoluteUrl } from '@/lib/helpers';
import { getSigninSchema, SigninSchemaType } from '../forms/signin-schema';

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const { login } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const usernamePlaceholder = intl.formatMessage({
    id: 'AUTH.SIGNIN.USERNAME_PLACEHOLDER',
    defaultMessage: 'Your username',
  });
  const passwordPlaceholder = intl.formatMessage({
    id: 'AUTH.SIGNIN.PASSWORD_PLACEHOLDER',
    defaultMessage: 'Your password',
  });
  const genericError = intl.formatMessage({
    id: 'AUTH.SIGNIN.GENERIC_ERROR',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  });

  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    if (errorParam) {
      setError(errorDescription || genericError);
    }
  }, [searchParams, genericError]);

  const form = useForm<SigninSchemaType>({
    resolver: zodResolver(getSigninSchema()),
    defaultValues: {
      email: 'yzta-admin',
      password: 'Yzta123!',
      rememberMe: true,
    },
  });

  async function onSubmit(values: SigninSchemaType) {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      await login(values.email.trim(), values.password);

      const nextPath = searchParams.get('next') || '/';
      navigate(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : genericError);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="block w-full space-y-5"
      >
        <div className="flex flex-col items-center gap-3 pb-3">
          <img
            src={toAbsoluteUrl('/media/app/kobailogo.png')}
            alt="Kobai"
            className="h-12 w-auto"
          />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              <FormattedMessage
                id="AUTH.SIGNIN.TITLE"
                defaultMessage="Sign In"
              />
            </h1>
            <p className="text-sm text-muted-foreground">
              <FormattedMessage
                id="AUTH.SIGNIN.SUBTITLE"
                defaultMessage="Welcome back. Log in with your credentials."
              />
            </p>
          </div>
        </div>

        {error && (
          <Alert
            variant="destructive"
            appearance="light"
            onClose={() => setError(null)}
          >
            <AlertIcon>
              <AlertCircle />
            </AlertIcon>
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        {successMessage && (
          <Alert appearance="light" onClose={() => setSuccessMessage(null)}>
            <AlertIcon>
              <Check />
            </AlertIcon>
            <AlertTitle>{successMessage}</AlertTitle>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <FormattedMessage
                  id="AUTH.SIGNIN.USERNAME"
                  defaultMessage="Username"
                />
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={usernamePlaceholder}
                  autoComplete="username"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center gap-2.5">
                <FormLabel>
                  <FormattedMessage
                    id="AUTH.SIGNIN.PASSWORD"
                    defaultMessage="Password"
                  />
                </FormLabel>
              </div>
              <div className="relative">
                <Input
                  placeholder={passwordPlaceholder}
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                >
                  {passwordVisible ? (
                    <EyeOff className="text-muted-foreground" />
                  ) : (
                    <Eye className="text-muted-foreground" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    <FormattedMessage
                      id="AUTH.SIGNIN.REMEMBER_ME"
                      defaultMessage="Remember me"
                    />
                  </FormLabel>
                </div>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isProcessing}>
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <LoaderCircleIcon className="h-4 w-4 animate-spin" />
              <FormattedMessage
                id="AUTH.SIGNIN.SUBMITTING"
                defaultMessage="Signing in..."
              />
            </span>
          ) : (
            <FormattedMessage
              id="AUTH.SIGNIN.SUBMIT"
              defaultMessage="Sign In"
            />
          )}
        </Button>
      </form>
    </Form>
  );
}
