export function formatPhone(value: string): string {
  if (!value) return '';
  // wa_id arrives without "+" — pretty-print as "+90 555 123 45 67" if 12 digits
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) {
    const cc = digits.slice(0, 2);
    const a = digits.slice(2, 5);
    const b = digits.slice(5, 8);
    const c = digits.slice(8, 10);
    const d = digits.slice(10, 12);
    return `+${cc} ${a} ${b} ${c} ${d}`;
  }
  return `+${digits}`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin} dk`;
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const sameYesterday =
    yest.getFullYear() === date.getFullYear() &&
    yest.getMonth() === date.getMonth() &&
    yest.getDate() === date.getDate();
  if (sameYesterday) return 'dün';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function formatBubbleTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();
  if (sameDay) return 'Bugün';

  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const sameYesterday =
    yest.getFullYear() === date.getFullYear() &&
    yest.getMonth() === date.getMonth() &&
    yest.getDate() === date.getDate();
  if (sameYesterday) return 'Dün';

  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
    .padEnd(1, fallback);
}
