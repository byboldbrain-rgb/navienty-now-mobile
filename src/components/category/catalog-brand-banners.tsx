import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Image from '../ui/app-image';
import type { SupermarketBrandBanner } from '../../services/supermarket-brand-banner-service';

/**
 * Copied from the supermarket's BrandBannerCard/BrandBanners implementation:
 * identical image cropping, circle position, padding and viewport geometry.
 * Brand assets and brand-to-product destination remain store-specific.
 */
function BrandBannerCard({
  banner,
  width,
  onPress,
}: {
  banner: SupermarketBrandBanner;
  width: number;
  onPress: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoDiameter = Math.min(90, Math.max(68, width * 0.71));
  const totalHeight = Math.round(width * 1.65) + 43;

  // Let freshly edited Supabase logo URLs retry without remounting the screen.
  useEffect(() => {
    setLogoFailed(false);
  }, [banner.logoUrl]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`عرض منتجات ${banner.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.brandBannerCard,
        { width, height: totalHeight },
        pressed && styles.brandBannerPressed,
      ]}
    >
      <View
        style={[
          styles.brandBannerPanel,
          { backgroundColor: banner.backgroundColor },
        ]}
      >
        <View style={styles.brandBannerGlow} pointerEvents="none" />
        <Image
          source={{ uri: banner.heroImageUrl }}
          style={styles.brandBannerHeroImage}
          resizeMode="cover"
          accessibilityLabel={banner.title}
        />
      </View>
      <View
        style={[
          styles.brandBannerCircle,
          {
            width: logoDiameter,
            height: logoDiameter,
            borderRadius: logoDiameter / 2,
            left: (width - logoDiameter) / 2,
          },
        ]}
      >
        {banner.logoUrl && !logoFailed ? (
          <Image
            source={{ uri: banner.logoUrl }}
            style={styles.brandBannerLogo}
            resizeMode="cover"
            onError={() => setLogoFailed(true)}
            accessibilityLabel={`شعار ${banner.title}`}
          />
        ) : (
          <View
            style={styles.brandBannerLogoPlaceholder}
            accessibilityLabel={`صورة ${banner.title} غير متاحة`}
          >
            <Ionicons
              name="storefront-outline"
              size={Math.round(logoDiameter * 0.37)}
              color="#B8BEC0"
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function CatalogBrandBanners({
  banners,
  pageWidth,
  onPress,
}: {
  banners: SupermarketBrandBanner[];
  pageWidth: number;
  onPress: (banner: SupermarketBrandBanner) => void;
}) {
  if (banners.length === 0) return null;
  const cardWidth = Math.max(104, Math.min(176, (pageWidth - 32 - 20) / 3));

  return (
    <View style={styles.brandBannersSection}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.brandBannersScroll}
        contentContainerStyle={styles.brandBannersRail}
      >
        {banners.map(banner => (
          <BrandBannerCard
            key={banner.id}
            banner={banner}
            width={cardWidth}
            onPress={() => onPress(banner)}
          />
        ))}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
    brandBannersSection: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      marginTop: 3,
      marginBottom: 25,
    },
    brandBannersScroll: {
      direction: 'ltr',
      width: '100%',
      overflow: 'visible',
    },
    brandBannersRail: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 5,
      paddingBottom: 6,
    },
    brandBannerCard: {
      flexShrink: 0,
      position: 'relative',
      overflow: 'visible',
    },
    brandBannerPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.98 }],
    },
    brandBannerPanel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: 43,
      borderRadius: 23,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandBannerGlow: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      width: '135%',
      height: '72%',
      borderRadius: 200,
      position: 'absolute',
      top: '3%',
      left: '-17.5%',
    },
    brandBannerHeroImage: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: '100%',
      height: '100%',
    },
    brandBannerCircle: {
      position: 'absolute',
      top: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      zIndex: 2,
      elevation: 2,
      shadowColor: '#111111',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.11,
      shadowRadius: 4,
    },
    brandBannerLogo: {
      width: '100%',
      height: '100%',
    },
    brandBannerLogoPlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
});
