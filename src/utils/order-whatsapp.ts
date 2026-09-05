import { Linking } from 'react-native';

import type { Order } from '../types/supabase-order';

const STANDARD_ORDER_WHATSAPP_MESSAGE =
  'أكد الاوردر بتاعي';

function normalizeWhatsAppNumber(
  number: string,
): string {
  let normalizedNumber =
    number.replace(/\D/g, '');

  if (
    normalizedNumber.startsWith(
      '00',
    )
  ) {
    normalizedNumber =
      normalizedNumber.slice(2);
  }

  if (
    normalizedNumber.startsWith(
      '0',
    )
  ) {
    normalizedNumber =
      `20${normalizedNumber.slice(1)}`;
  }

  if (!normalizedNumber) {
    throw new Error(
      'رقم واتساب غير مضبوط في Supabase.',
    );
  }

  return normalizedNumber;
}

export function buildOrderWhatsAppUrl(
  order: Pick<
    Order,
    | 'whatsappNumber'
    | 'whatsappMessage'
  >,
): string {
  const whatsappNumber =
    normalizeWhatsAppNumber(
      order.whatsappNumber,
    );

  /*
   * Order details — including the complete printing configuration — are
   * already persisted in Supabase. WhatsApp is only the customer's standard
   * confirmation handoff, so print jobs must use the exact same short message
   * as every other store order instead of duplicating order/file details here.
   */
  return (
    `https://wa.me/${whatsappNumber}` +
    `?text=${encodeURIComponent(
      STANDARD_ORDER_WHATSAPP_MESSAGE,
    )}`
  );
}

export async function openOrderInWhatsApp(
  order: Pick<
    Order,
    | 'whatsappNumber'
    | 'whatsappMessage'
  >,
): Promise<void> {
  const whatsappUrl =
    buildOrderWhatsAppUrl(order);

  await Linking.openURL(
    whatsappUrl,
  );
}
