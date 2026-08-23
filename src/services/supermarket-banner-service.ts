import {
  type CategoryPromotionBanner,
  type CategoryPromotionBannerAudience,
  listCategoryPromotionBanners,
} from './category-promotion-banner-service';

export type SupermarketPromotionBanner =
  CategoryPromotionBanner;

type ListSupermarketPromotionBannersParams = {
  storeId: string;
  audience?: CategoryPromotionBannerAudience;
};

export async function listSupermarketPromotionBanners({
  storeId,
  audience,
}: ListSupermarketPromotionBannersParams): Promise<
  SupermarketPromotionBanner[]
> {
  return listCategoryPromotionBanners({
    placement: 'supermarket',
    storeId,
    audience,
  });
}

export default listSupermarketPromotionBanners;
