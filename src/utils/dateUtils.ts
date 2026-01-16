import { format, subHours, isAfter, parseISO } from 'date-fns';

export function formatDate(date: Date): string {
  return format(date, 'MMMM d, yyyy');
}

export function formatDateTime(date: Date): string {
  return format(date, 'MMMM d, yyyy HH:mm');
}

export function formatDateShort(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getDateRangeStart(hoursBack: number): Date {
  return subHours(new Date(), hoursBack);
}

export function isWithinHours(date: Date, hours: number): boolean {
  const cutoff = subHours(new Date(), hours);
  return isAfter(date, cutoff);
}

export function parseDate(dateStr: string): Date {
  // Handle various date formats from Gmail
  const parsed = parseISO(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try parsing as a raw timestamp
  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }

  return new Date();
}

export function getSummaryFileName(date: Date = new Date()): string {
  return `${formatDateShort(date)}.json`;
}
