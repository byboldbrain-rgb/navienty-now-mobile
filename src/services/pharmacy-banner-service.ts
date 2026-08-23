import {
  type CategoryPromotionBanner,
  type CategoryPromotionBannerAudience,
  listCategoryPromotionBanners,
} from './category-promotion-banner-service';

export type PharmacyPromotionBanner =
  CategoryPromotionBanner;

type ListPharmacyPromotionBannersParams = {
  storeId: string;
  audience?: CategoryPromotionBannerAudience;
};

export async function listPharmacyPromotionBanners({
  storeId,
  audience,
}: ListPharmacyPromotionBannersParams): Promise<
  PharmacyPromotionBanner[]
> {
  return listCategoryPromotionBanners({
    placement: 'pharmacy',
    storeId,
    audience,
  });
}

export default listPharmacyPromotionBanners;
