import { toAbsoluteUrl } from '@/lib/helpers';
import enMessages from './messages/en.json';
import trMessages from './messages/tr.json';
import { type Language } from './types';

const I18N_MESSAGES = {
  tr: trMessages,
  en: enMessages,
};

const I18N_CONFIG_KEY = 'i18nConfig';

const I18N_LANGUAGES: Language[] = [
  {
    label: 'Türkçe',
    code: 'tr',
    direction: 'ltr',
    flag: toAbsoluteUrl('/media/flags/turkey.svg'),
    messages: I18N_MESSAGES.tr,
  },
  {
    label: 'English',
    code: 'en',
    direction: 'ltr',
    flag: toAbsoluteUrl('/media/flags/united-states.svg'),
    messages: I18N_MESSAGES.en,
  },
];

const I18N_DEFAULT_LANGUAGE: Language = I18N_LANGUAGES[0];

export {
  I18N_CONFIG_KEY,
  I18N_DEFAULT_LANGUAGE,
  I18N_LANGUAGES,
  I18N_MESSAGES,
};
