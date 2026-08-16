export type PromoPresentationType =
  | 'direct_link'
  | 'detail_screen';

export type PromoActionType =
  | 'none'
  | 'whatsapp'
  | 'external_url'
  | 'category'
  | 'store'
  | 'route'
  | 'service_checkout';

export type PromoImageFit =
  | 'cover'
  | 'contain';

export type PromoSectionStyle =
  | 'plain'
  | 'soft'
  | 'accent'
  | 'dark';

export type PromoImageBlockAction =
  | 'none'
  | 'primary';

export type PromoActionPayload = {
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  url?: string | null;
  categorySlug?: string | null;
  storeId?: string | null;
  route?: string | null;
  servicePackageId?: string | null;
};

export type PromoImageBlock = {
  id?: string | null;
  imageUrl: string;
  imageAlt?: string | null;
  imageFit?: PromoImageFit;
  aspectRatio?: number | null;
  action?: PromoImageBlockAction;
  horizontalInset?: number | null;
  cornerRadius?: number | null;
  gapAfter?: number | null;
  backgroundColor?: string | null;
};

/*
 * Legacy campaign-content types are kept for compatibility with existing
 * campaign JSON/admin code. The simplified promo screen does not render
 * these blocks.
 */
export type PromoHighlight = {
  imageUrl?: string | null;
  imageFit?: PromoImageFit;
  imageAlt?: string | null;
  icon?: string | null;
  title: string;
  description?: string | null;
};

export type PromoSectionItem = {
  imageUrl?: string | null;
  imageFit?: PromoImageFit;
  imageAlt?: string | null;
  icon?: string | null;
  title: string;
  description?: string | null;
};

export type PromoSection = {
  id?: string | null;
  eyebrow?: string | null;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageFit?: PromoImageFit;
  style?: PromoSectionStyle;
  items?: PromoSectionItem[];
};

export type PromoFaqItem = {
  question: string;
  answer: string;
};

export type PromoCampaignContent = {
  imageBlocks?: PromoImageBlock[];

  brandLabel?: string | null;
  badge?: string | null;
  title?: string | null;
  titleAccent?: string | null;
  subtitle?: string | null;
  heroImageUrl?: string | null;
  heroImageFit?: PromoImageFit;
  availabilityLabel?: string | null;
  highlights?: PromoHighlight[];
  sections?: PromoSection[];
  faq?: PromoFaqItem[];
  termsText?: string | null;
  ctaLabel?: string | null;
  ctaHint?: string | null;
};

export type PromoCampaignTheme = {
  backgroundColor?: string | null;
  surfaceColor?: string | null;
  heroBackgroundColor?: string | null;
  primaryColor?: string | null;
  buttonColor?: string | null;
  buttonTextColor?: string | null;
  textColor?: string | null;
  mutedTextColor?: string | null;
  accentColor?: string | null;
  borderColor?: string | null;
  darkSectionColor?: string | null;
  darkSectionTextColor?: string | null;
};
