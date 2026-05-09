export const fmtTRY = (value: number, locale = 'tr-TR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

export const fmtNumber = (value: number, locale = 'tr-TR') =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);

export const fmtPct = (value: number, locale = 'tr-TR') =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
