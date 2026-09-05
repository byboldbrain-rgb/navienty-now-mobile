import { Linking } from 'react-native';

import type { Order } from '../types/supabase-order';

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

  if (
    !order.whatsappMessage.trim()
  ) {
    throw new Error(
      'رسالة واتساب لم ترجع من Supabase.',
    );
  }

  return (
    `https://wa.me/${whatsappNumber}` +
    `?text=${encodeURIComponent(
      order.whatsappMessage,
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
