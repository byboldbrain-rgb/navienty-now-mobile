import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogProduct } from '../../services/catalog-service';
import {
  getShoppingBannerProductPage,
  SHOPPING_BANNER_PAGE_SIZE,
  type ShoppingCategorySlug,
} from '../../services/shopping-banner-product-service';

export function ShoppingBannerProductRail({
  bannerId, storeId, categorySlug, serviceAreaId,
  cardWidth, overlap, renderProduct,
}: {
  bannerId: string;
  storeId: string;
  categorySlug: ShoppingCategorySlug;
  serviceAreaId: string | null;
  cardWidth: number;
  overlap: number;
  renderProduct: (product: CatalogProduct) => ReactElement;
}) {
  const query = useInfiniteQuery({
    queryKey: ['public',categorySlug,'banner-products-v1',storeId,serviceAreaId ?? '*',bannerId],
    queryFn: ({ pageParam }) => getShoppingBannerProductPage({
      bannerId, storeId, categorySlug, serviceAreaId, offset: pageParam,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * SHOPPING_BANNER_PAGE_SIZE : undefined,
    staleTime: 90_000,
    retry: 1,
    meta: { persist: false },
  });
  const items = useMemo(
    () => query.data?.pages.flatMap(p => p.items) ?? [],
    [query.data],
  );
  // A branding-only banner is valid. Never render an empty technical error
  // when the banner has no linked products.
  if (query.isPending) {
    return (
      <View style={[styles.loading, { marginTop: -overlap }]} >
        <ActivityIndicator size="small" color="#00B956" />
      </View>
    );
  }
  if (query.isError && items.length === 0) {
    return (
      <Pressable style={[styles.retry, { marginTop: -overlap }]} onPress={() => void query.refetch()}>
        <Text style={styles.retryText}>تعذر تحميل المنتجات. اضغط لإعادة المحاولة</Text>
      </Pressable>
    );
  }
  if (items.length === 0) return null;
  return (
    <FlatList
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      data={items}
      keyExtractor={p => p.id}
      renderItem={({ item }) => renderProduct(item)}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={4}
      maxToRenderPerBatch={6}
      windowSize={5}
      onEndReachedThreshold={0.65}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      ListFooterComponent={query.isFetchingNextPage
        ? <ActivityIndicator size="small" color="#00B956" style={{ marginHorizontal: 15 }} />
        : query.isFetchNextPageError
          ? <Pressable onPress={() => void query.fetchNextPage()} style={styles.footer}>
              <Text style={styles.retryText}>عرض المزيد</Text>
            </Pressable>
          : null}
      contentContainerStyle={styles.rail}
      style={[styles.railScroll, { marginTop: -overlap }]}
      getItemLayout={(_data, index) => ({
        index, length: cardWidth + 7, offset: 8 + index * (cardWidth + 7),
      })}
    />
  );
}
const styles = StyleSheet.create({
  railScroll: {
    elevation: 10,
    overflow: 'visible',
    position: 'relative',
    zIndex: 10,
  },
  rail: { alignItems: 'flex-start', gap: 7, paddingHorizontal: 8, paddingBottom: 7, paddingTop: 0 },
  loading: { backgroundColor: '#FFFFFF', borderRadius: 12, minHeight: 74, justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 10, elevation: 10, alignSelf: 'center', width: '85%' },
  retry: { backgroundColor: '#FFFFFF', borderRadius: 12, minHeight: 74, justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', position: 'relative', zIndex: 10, elevation: 10, alignSelf: 'center', width: '85%' },
  footer: { justifyContent: 'center', padding: 14 },
  retryText: { color: '#606060', fontSize: 12, textAlign: 'center', writingDirection: 'rtl' },
});
