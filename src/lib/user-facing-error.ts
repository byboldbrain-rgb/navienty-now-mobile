/**
 * This module is intentionally pure: errors may contain internal Supabase
 * details that must never be rendered in customer-facing UI.
 */
const TRANSIENT_ERROR =
  /network|failed to fetch|fetch failed|timeout|timed out|abort|connection|offline|internet|econn|socket|unreachable|gateway|temporar|status\s*50[0234]|status\s*429|status\s*408/i;

const ALLOWED_BUSINESS_MESSAGES = new Set([
  'لا يوجد سوبر ماركت متاح حاليًا.',
  'لم يتم العثور على فئة السوبر ماركت المطلوبة.',
]);

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function isRetryablePublicQueryError(error: unknown): boolean {
  return TRANSIENT_ERROR.test(getRawErrorMessage(error));
}

export function getUserFacingCatalogError(error: unknown): string {
  const message = getRawErrorMessage(error);
  if (ALLOWED_BUSINESS_MESSAGES.has(message)) return message;
  if (isRetryablePublicQueryError(error)) {
    return 'الاتصال بالإنترنت مش مستقر حاليًا. تأكد من الشبكة وحاول مرة تانية.';
  }
  return 'مش قادرين نعرض المنتجات دلوقتي. حاول مرة تانية بعد شوية.';
}
