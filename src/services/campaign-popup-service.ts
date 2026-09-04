import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import { publicSupabase } from '../lib/supabase';

export type CampaignPopupAudience =
  | 'signed_out'
  | 'signed_in';

export type CampaignPopupFrequency =
  | 'once_per_campaign'
  | 'once_per_day'
  | 'once_per_session'
  | 'always';

export type CampaignPopupActionType =
  | 'none'
  | 'whatsapp'
  | 'external_url'
  | 'category'
  | 'store'
  | 'route'
  | 'service_checkout';

export type CampaignPopupActionPayload = {
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  url?: string | null;
  categorySlug?: string | null;
  storeId?: string | null;
  route?: string | null;
  servicePackageId?: string | null;
};

export type CampaignPopupTheme = {
  surfaceColor: string;
  primaryColor: string;
  buttonColor: string;
  buttonTextColor: string;
  textColor: string;
  borderColor: string;
  backdropColor: string;
};

export type CampaignPopupConfig = {
  frequency: CampaignPopupFrequency;
  version: number;
  dismissible: boolean;
  showDelayMs: number;
  imageFit: 'cover' | 'contain';
};

export type CampaignPopup = {
  id: string;
  adminLabel: string;
  imageUrl: string;
  altTextAr: string | null;
  linkUrl: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  actionType: CampaignPopupActionType;
  actionPayload: CampaignPopupActionPayload;
  serviceAreaIds: string[];
  theme: CampaignPopupTheme;
  config: CampaignPopupConfig;
};

export type CampaignPopupRouter = {
  push: (href: any) => void;
};

type CampaignPopupServiceAreaRow = {
  service_area_id: string | null;
};

type CampaignPopupRow = {
  id: string;
  admin_label: string;
  image_url: string;
  alt_text_ar: string | null;
  link_url: string | null;
  audience: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  action_type: string | null;
  action_payload: unknown;
  content: unknown;
  theme: unknown;
  service_package_id: string | null;
  home_banner_service_areas:
    | CampaignPopupServiceAreaRow[]
    | null;
};

type CampaignPopupLocalState = {
  version: number;
  lastShownAt: string | null;
  lastShownCairoDate: string | null;
  impressions: number;
};

const CAMPAIGN_POPUP_SELECT = [
  'id',
  'admin_label',
  'image_url',
  'alt_text_ar',
  'link_url',
  'audience',
  'sort_order',
  'starts_at',
  'ends_at',
  'action_type',
  'action_payload',
  'content',
  'theme',
  'service_package_id',
  'home_banner_service_areas(service_area_id)',
].join(',');

const CAMPAIGN_POPUP_STORAGE_PREFIX =
  '@navienty/campaign-popup/v1';

const sessionPresentedKeys = new Set<string>();

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];

  return typeof value === 'string' &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

function getBoolean(
  source: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = source[key];

  return typeof value === 'boolean'
    ? value
    : null;
}

function getFiniteNumber(
  source: Record<string, unknown>,
  key: string,
): number | null {
  const value = source[key];

  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null;
}

function getNestedRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = source[key];

  return isRecord(value) ? value : {};
}

function normalizeActionType(
  value: string | null,
): CampaignPopupActionType {
  return value === 'whatsapp' ||
    value === 'external_url' ||
    value === 'category' ||
    value === 'store' ||
    value === 'route' ||
    value === 'service_checkout' ||
    value === 'none'
    ? value
    : 'none';
}

function normalizeActionPayload(
  value: unknown,
  servicePackageId: string | null,
): CampaignPopupActionPayload {
  if (!isRecord(value)) {
    return {
      servicePackageId,
    };
  }

  return {
    whatsappNumber:
      getString(value, 'whatsapp_number'),
    whatsappMessage:
      getString(value, 'whatsapp_message'),
    url: getString(value, 'url'),
    categorySlug:
      getString(value, 'category_slug'),
    storeId:
      getString(value, 'store_id'),
    route: getString(value, 'route'),
    servicePackageId:
      getString(
        value,
        'service_package_id',
      ) ?? servicePackageId,
  };
}

function normalizeFrequency(
  value: unknown,
): CampaignPopupFrequency {
  return value === 'once_per_campaign' ||
    value === 'once_per_day' ||
    value === 'once_per_session' ||
    value === 'always'
    ? value
    : 'once_per_campaign';
}

function normalizeConfig(
  content: Record<string, unknown>,
): CampaignPopupConfig {
  const popup = getNestedRecord(
    content,
    'popup',
  );

  const rawVersion =
    getFiniteNumber(popup, 'version');

  const rawDelay = getFiniteNumber(
    popup,
    'show_delay_ms',
  );

  const rawImageFit = getString(
    popup,
    'image_fit',
  );

  return {
    frequency: normalizeFrequency(
      popup.frequency,
    ),
    version:
      rawVersion !== null && rawVersion >= 1
        ? Math.floor(rawVersion)
        : 1,
    dismissible:
      getBoolean(popup, 'dismissible') ??
      true,
    showDelayMs:
      rawDelay !== null
        ? Math.max(
            0,
            Math.min(
              5000,
              Math.floor(rawDelay),
            ),
          )
        : 350,
    imageFit:
      rawImageFit === 'contain'
        ? 'contain'
        : 'cover',
  };
}

function normalizeTheme(
  value: unknown,
): CampaignPopupTheme {
  const theme = isRecord(value)
    ? value
    : {};

  return {
    surfaceColor:
      getString(theme, 'surface_color') ??
      '#FEFDF9',
    primaryColor:
      getString(theme, 'primary_color') ??
      '#168A3A',
    buttonColor:
      getString(theme, 'button_color') ??
      '#087D30',
    buttonTextColor:
      getString(
        theme,
        'button_text_color',
      ) ?? '#FFFFFF',
    textColor:
      getString(theme, 'text_color') ??
      '#151915',
    borderColor:
      getString(theme, 'border_color') ??
      'rgba(5, 91, 42, 0.08)',
    backdropColor:
      getString(theme, 'backdrop_color') ??
      'rgba(0, 18, 10, 0.66)',
  };
}

function isCurrentlyVisible(
  row: CampaignPopupRow,
  nowMs: number,
): boolean {
  const startsAtMs = row.starts_at
    ? Date.parse(row.starts_at)
    : null;

  const endsAtMs = row.ends_at
    ? Date.parse(row.ends_at)
    : null;

  if (
    startsAtMs !== null &&
    !Number.isNaN(startsAtMs) &&
    startsAtMs > nowMs
  ) {
    return false;
  }

  if (
    endsAtMs !== null &&
    !Number.isNaN(endsAtMs) &&
    endsAtMs <= nowMs
  ) {
    return false;
  }

  return true;
}

function getServiceAreaIds(
  row: CampaignPopupRow,
): string[] {
  return Array.from(
    new Set(
      (
        row.home_banner_service_areas ?? []
      )
        .map((item) =>
          typeof item.service_area_id === 'string'
            ? item.service_area_id.trim()
            : '',
        )
        .filter(Boolean),
    ),
  );
}

function isAvailableForServiceArea(
  row: CampaignPopupRow,
  serviceAreaId?: string | null,
): boolean {
  const targetIds = getServiceAreaIds(row);

  if (targetIds.length === 0) {
    return true;
  }

  if (!serviceAreaId) {
    return false;
  }

  return targetIds.includes(serviceAreaId);
}

function mapCampaignPopup(
  row: CampaignPopupRow,
): CampaignPopup | null {
  const content = isRecord(row.content)
    ? row.content
    : {};

  const title = getString(
    content,
    'title',
  );

  const imageUrl = row.image_url.trim();
  const ctaLabel =
    getString(content, 'cta_label');
  const config = normalizeConfig(content);

  // Never allow a remote configuration to create a modal
  // the customer cannot close. Non-dismissible campaigns
  // must always provide a primary CTA.
  if (
    !title ||
    !imageUrl ||
    (!config.dismissible && !ctaLabel)
  ) {
    return null;
  }

  return {
    id: row.id,
    adminLabel: row.admin_label.trim(),
    imageUrl,
    altTextAr:
      row.alt_text_ar?.trim() || null,
    linkUrl:
      row.link_url?.trim() || null,
    title,
    subtitle:
      getString(content, 'subtitle'),
    ctaLabel,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    actionType: normalizeActionType(
      row.action_type,
    ),
    actionPayload: normalizeActionPayload(
      row.action_payload,
      row.service_package_id,
    ),
    serviceAreaIds:
      getServiceAreaIds(row),
    theme: normalizeTheme(row.theme),
    config,
  };
}

function getCampaignKey(
  campaign: CampaignPopup,
): string {
  return `${campaign.id}:v${campaign.config.version}`;
}

function getStorageKey(
  campaign: CampaignPopup,
): string {
  return `${CAMPAIGN_POPUP_STORAGE_PREFIX}:${campaign.id}`;
}

function getCairoDateKey(
  date = new Date(),
): string {
  try {
    const formatter =
      new Intl.DateTimeFormat(
        'en-CA',
        {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'Africa/Cairo',
          year: 'numeric',
        },
      );

    const parts =
      formatter.formatToParts(date);

    const year =
      parts.find(
        (part) => part.type === 'year',
      )?.value;
    const month =
      parts.find(
        (part) => part.type === 'month',
      )?.value;
    const day =
      parts.find(
        (part) => part.type === 'day',
      )?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }

    throw new Error(
      'Unable to resolve Cairo calendar date.',
    );
  } catch {
    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1,
    ).padStart(2, '0');
    const day = String(
      date.getDate(),
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

async function readLocalState(
  campaign: CampaignPopup,
): Promise<CampaignPopupLocalState | null> {
  try {
    const raw = await AsyncStorage.getItem(
      getStorageKey(campaign),
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    const version =
      typeof parsed.version === 'number' &&
      Number.isFinite(parsed.version)
        ? Math.floor(parsed.version)
        : 0;

    const impressions =
      typeof parsed.impressions === 'number' &&
      Number.isFinite(parsed.impressions)
        ? Math.max(
            0,
            Math.floor(parsed.impressions),
          )
        : 0;

    return {
      version,
      impressions,
      lastShownAt:
        typeof parsed.lastShownAt === 'string'
          ? parsed.lastShownAt
          : null,
      lastShownCairoDate:
        typeof parsed.lastShownCairoDate ===
        'string'
          ? parsed.lastShownCairoDate
          : null,
    };
  } catch {
    return null;
  }
}

async function isEligibleByFrequency(
  campaign: CampaignPopup,
): Promise<boolean> {
  const frequency =
    campaign.config.frequency;

  if (frequency === 'always') {
    return true;
  }

  const key = getCampaignKey(campaign);

  if (
    frequency === 'once_per_session'
  ) {
    return !sessionPresentedKeys.has(key);
  }

  const localState =
    await readLocalState(campaign);

  if (frequency === 'once_per_day') {
    if (
      localState?.version !==
      campaign.config.version
    ) {
      return true;
    }

    return (
      localState.lastShownCairoDate !==
      getCairoDateKey()
    );
  }

  return (
    localState?.version !==
    campaign.config.version
  );
}

async function listCampaignPopups(
  audience: CampaignPopupAudience,
  serviceAreaId?: string | null,
): Promise<CampaignPopup[]> {
  const allowedAudiences = [
    'all',
    audience,
  ];

  const { data, error } =
    await publicSupabase
      .from('home_banners')
      .select(CAMPAIGN_POPUP_SELECT)
      .eq('is_active', true)
      .eq('placement', 'campaign_popup')
      .in('audience', allowedAudiences)
      .order('sort_order', {
        ascending: true,
      })
      .order('id', {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  const nowMs = Date.now();

  return ((data ?? []) as unknown as CampaignPopupRow[])
    .filter(
      (row) =>
        isCurrentlyVisible(row, nowMs) &&
        isAvailableForServiceArea(
          row,
          serviceAreaId,
        ),
    )
    .map(mapCampaignPopup)
    .filter(
      (
        campaign,
      ): campaign is CampaignPopup =>
        campaign !== null,
    );
}

export async function loadEligibleCampaignPopup(
  audience: CampaignPopupAudience,
  serviceAreaId?: string | null,
): Promise<CampaignPopup | null> {
  const campaigns =
    await listCampaignPopups(
      audience,
      serviceAreaId,
    );

  for (const campaign of campaigns) {
    if (
      await isEligibleByFrequency(campaign)
    ) {
      return campaign;
    }
  }

  return null;
}

export async function markCampaignPopupPresented(
  campaign: CampaignPopup,
): Promise<void> {
  const key = getCampaignKey(campaign);
  sessionPresentedKeys.add(key);

  if (
    campaign.config.frequency ===
      'once_per_session' ||
    campaign.config.frequency === 'always'
  ) {
    return;
  }

  const previousState =
    await readLocalState(campaign);

  const nextState: CampaignPopupLocalState = {
    version: campaign.config.version,
    lastShownAt: new Date().toISOString(),
    lastShownCairoDate:
      getCairoDateKey(),
    impressions:
      previousState?.version ===
      campaign.config.version
        ? previousState.impressions + 1
        : 1,
  };

  try {
    await AsyncStorage.setItem(
      getStorageKey(campaign),
      JSON.stringify(nextState),
    );
  } catch {
    // Frequency persistence must never break Home.
  }
}

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

export async function openCampaignPopupAction({
  campaign,
  router,
}: {
  campaign: CampaignPopup;
  router: CampaignPopupRouter;
}): Promise<boolean> {
  const payload = campaign.actionPayload;

  switch (campaign.actionType) {
    case 'service_checkout': {
      const servicePackageId =
        payload.servicePackageId?.trim();

      if (!servicePackageId) {
        return false;
      }

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
        payload.whatsappNumber?.trim() ?? '';

      const url = buildWhatsAppUrl(
        number,
        payload.whatsappMessage,
      );

      if (!url) {
        return false;
      }

      await Linking.openURL(url);
      return true;
    }

    case 'external_url': {
      const url =
        payload.url?.trim() ||
        campaign.linkUrl;

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
      const storeId =
        payload.storeId?.trim();

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
      const route =
        payload.route?.trim();

      if (!route) {
        return false;
      }

      router.push(route);
      return true;
    }

    case 'none':
    default: {
      if (!campaign.linkUrl) {
        return false;
      }

      await Linking.openURL(
        campaign.linkUrl,
      );
      return true;
    }
  }
}
