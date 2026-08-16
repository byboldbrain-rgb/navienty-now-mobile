import { Linking } from 'react-native';

import type { HomeBanner } from './home-banners-service';

export type PromoRouter = {
  push: (href: any) => void;
};

type OpenPromoActionOptions = {
  banner: HomeBanner;
  router: PromoRouter;
  fallbackWhatsAppNumber?: string | null;
};

function normalizeWhatsAppNumber(
  value: string,
): string {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('20')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `20${digits.slice(1)}`;
  }

  return digits;
}

function buildWhatsAppUrl(
  number: string,
  message?: string | null,
): string | null {
  const normalizedNumber =
    normalizeWhatsAppNumber(number);

  if (!normalizedNumber) {
    return null;
  }

  const baseUrl =
    `https://wa.me/${normalizedNumber}`;

  const normalizedMessage =
    message?.trim() ?? '';

  if (!normalizedMessage) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(
    normalizedMessage,
  )}`;
}

function isBookstoreSlug(
  slug: string,
): boolean {
  const normalizedSlug =
    slug.trim().toLowerCase();

  return (
    normalizedSlug === 'bookstore' ||
    normalizedSlug === 'bookstores' ||
    normalizedSlug === 'book-store' ||
    normalizedSlug === 'library' ||
    normalizedSlug === 'books' ||
    normalizedSlug === 'stationery'
  );
}

function hasHomeBannerAction(
  banner: HomeBanner,
): boolean {
  if (banner.actionType !== 'none') {
    return true;
  }

  return Boolean(banner.linkUrl);
}

function canOpenHomeBanner(
  banner: HomeBanner,
): boolean {
  return (
    banner.presentationType === 'detail_screen' ||
    hasHomeBannerAction(banner)
  );
}

async function openHomeBannerAction({
  banner,
  router,
  fallbackWhatsAppNumber,
}: OpenPromoActionOptions): Promise<boolean> {
  const payload = banner.actionPayload;

  switch (banner.actionType) {
    case 'service_checkout': {
      const servicePackageId =
        banner.servicePackageId ||
        payload.servicePackageId ||
        '';

      if (!servicePackageId) {
        return false;
      }

      /*
       * The checkout screen must read servicePackageId from
       * useLocalSearchParams(), then fetch the package and price
       * from Supabase. Never trust a price passed in route params.
       */
      router.push({
        pathname: '/checkout',
        params: {
          servicePackageId,
        },
      });

      return true;
    }

    case 'whatsapp': {
      const number =
        payload.whatsappNumber ||
        fallbackWhatsAppNumber ||
        '';

      const whatsappUrl = buildWhatsAppUrl(
        number,
        payload.whatsappMessage,
      );

      if (!whatsappUrl) {
        return false;
      }

      await Linking.openURL(whatsappUrl);
      return true;
    }

    case 'external_url': {
      const url =
        payload.url || banner.linkUrl;

      if (!url) {
        return false;
      }

      await Linking.openURL(url);
      return true;
    }

    case 'category': {
      const categorySlug =
        payload.categorySlug?.trim();

      if (!categorySlug) {
        return false;
      }

      const normalizedSlug =
        categorySlug.toLowerCase();

      if (normalizedSlug === 'supermarket') {
        router.push('/category/supermarket');
        return true;
      }

      if (isBookstoreSlug(normalizedSlug)) {
        router.push('/category/bookstore');
        return true;
      }

      router.push({
        pathname: '/category/[id]',
        params: {
          id: categorySlug,
        },
      });
      return true;
    }

    case 'store': {
      const storeId = payload.storeId?.trim();

      if (!storeId) {
        return false;
      }

      router.push({
        pathname: '/store/[id]',
        params: {
          id: storeId,
        },
      });
      return true;
    }

    case 'route': {
      const route = payload.route?.trim();

      if (!route) {
        return false;
      }

      router.push(route);
      return true;
    }

    case 'none':
    default: {
      if (!banner.linkUrl) {
        return false;
      }

      await Linking.openURL(banner.linkUrl);
      return true;
    }
  }
}

export {
    buildWhatsAppUrl,
    canOpenHomeBanner,
    hasHomeBannerAction,
    openHomeBannerAction
};

