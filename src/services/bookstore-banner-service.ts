import {
  type CategoryPromotionBanner,
  type CategoryPromotionBannerAudience,
  listCategoryPromotionBanners,
} from './category-promotion-banner-service';

export type BookstorePromotionBanner =
  CategoryPromotionBanner;

type ListBookstorePromotionBannersParams = {
  storeId: string;
  audience?: CategoryPromotionBannerAudience;
};

export async function listBookstorePromotionBanners({
  storeId,
  audience,
}: ListBookstorePromotionBannersParams): Promise<
  BookstorePromotionBanner[]
> {
  return listCategoryPromotionBanners({
    placement: 'bookstore',
    storeId,
    audience,
  });
}

export default listBookstorePromotionBanners;
