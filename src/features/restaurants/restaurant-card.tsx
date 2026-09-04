import { Image as ExpoImage } from 'expo-image';
import {
  memo,
  useEffect,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { StoreSummary } from '../../services/catalog-service';
import {
  getStoreCoverUrl,
  getStoreInitial,
  getStoreLogoUrl,
  getStoreRatingInfo,
} from './restaurants-domain';

type RestaurantCardProps = {
  priority?: 'high' | 'normal' | 'low';
  store: StoreSummary;
  onPress: (store: StoreSummary) => void;
};

function StoreArtwork({
  priority = 'normal',
  store,
}: {
  priority?: 'high' | 'normal' | 'low';
  store: StoreSummary;
}) {
  const coverUrl = getStoreCoverUrl(store);
  const logoUrl = getStoreLogoUrl(store);

  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(
    null,
  );
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (failedCoverUrl && failedCoverUrl !== coverUrl) {
      setFailedCoverUrl(null);
    }
  }, [coverUrl, failedCoverUrl]);

  useEffect(() => {
    if (failedLogoUrl && failedLogoUrl !== logoUrl) {
      setFailedLogoUrl(null);
    }
  }, [failedLogoUrl, logoUrl]);

  const canShowCover = Boolean(coverUrl && coverUrl !== failedCoverUrl);
  const canShowLogo = Boolean(logoUrl && logoUrl !== failedLogoUrl);

  return (
    <View style={styles.storeArtwork}>
      {canShowCover ? (
        <ExpoImage
          accessibilityLabel={`صورة الغلاف الخاصة بـ ${store.name}`}
          cachePolicy="memory-disk"
          contentFit="cover"
          priority={priority}
          source={coverUrl ?? ''}
          style={styles.storeCoverImage}
          transition={120}
          onError={() => {
            if (coverUrl) {
              setFailedCoverUrl(coverUrl);
            }
          }}
        />
      ) : (
        <View style={styles.storeCoverFallback}>
          <Text style={styles.storeCoverFallbackText}>
            {getStoreInitial(store)}
          </Text>
        </View>
      )}

      <View style={styles.logoBadge}>
        {canShowLogo ? (
          <ExpoImage
            accessibilityLabel={`لوجو ${store.name}`}
            cachePolicy="memory-disk"
            contentFit="contain"
            priority={priority}
            source={logoUrl ?? ''}
            style={styles.logoImage}
            transition={100}
            onError={() => {
              if (logoUrl) {
                setFailedLogoUrl(logoUrl);
              }
            }}
          />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoFallbackText}>
              {getStoreInitial(store)}
            </Text>
          </View>
        )}
      </View>

      {store.isManuallyClosed && (
        <View style={styles.closedOverlay}>
          <Text style={styles.closedOverlayText}>مغلق</Text>
        </View>
      )}
    </View>
  );
}

function RestaurantCardComponent({
  priority = 'normal',
  store,
  onPress,
}: RestaurantCardProps) {
  const ratingInfo = getStoreRatingInfo(store);

  return (
    <Pressable
      accessibilityLabel={
        store.isManuallyClosed
          ? `${store.name} مغلق`
          : `فتح ${store.name}`
      }
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.storeRow,
        store.isManuallyClosed && styles.storeRowClosed,
        pressed && styles.storeRowPressed,
      ]}
      onPress={() => onPress(store)}
    >
      <StoreArtwork priority={priority} store={store} />

      <View
        style={[
          styles.storeBody,
          store.isManuallyClosed && styles.storeBodyClosed,
        ]}
      >
        <View
          style={[
            styles.storeNameRow,
            store.isManuallyClosed && styles.storeNameRowClosed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.storeName,
              store.isManuallyClosed && styles.storeNameClosed,
            ]}
          >
            {store.name}
          </Text>
        </View>

        {store.isManuallyClosed ? (
          <View style={styles.closedStoreMetaRow}>
            {ratingInfo.hasRatings && ratingInfo.rating !== null ? (
              <View style={styles.closedRatingGroup}>
                <Text style={styles.closedRatingStar}>★</Text>
                <Text style={styles.closedMetaText}>
                  {ratingInfo.rating.toFixed(1)}
                </Text>
              </View>
            ) : (
              <Text style={styles.closedMetaText}>New</Text>
            )}
          </View>
        ) : (
          <View style={styles.storeMetaRow}>
            {ratingInfo.hasRatings && ratingInfo.rating !== null ? (
              <>
                <Text style={styles.ratingStar}>★</Text>
                <Text style={styles.ratingText}>
                  {ratingInfo.rating.toFixed(1)}
                </Text>
              </>
            ) : (
              <Text style={styles.newStoreText}>New</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const RestaurantCard = memo(RestaurantCardComponent);

const styles = StyleSheet.create({
  storeRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    direction: 'ltr',
    flexDirection: 'row-reverse',
    gap: 14,
    minHeight: 128,
    paddingVertical: 8,
    width: '100%',
  },

  storeRowClosed: {
    flexDirection: 'row-reverse',
  },

  storeRowPressed: {
    opacity: 0.76,
  },

  storeArtwork: {
    backgroundColor: '#EFEFEF',
    borderRadius: 21,
    flexShrink: 0,
    height: 112,
    overflow: 'hidden',
    position: 'relative',
    width: 132,
  },

  storeCoverImage: {
    height: '100%',
    width: '100%',
  },

  storeCoverFallback: {
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    flex: 1,
    justifyContent: 'center',
  },

  storeCoverFallbackText: {
    color: '#8B8B92',
    fontSize: 34,
    fontWeight: '900',
  },

  logoBadge: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 17,
    borderWidth: 1,
    elevation: 3,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
    shadowColor: '#000000',
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    top: 8,
    width: 50,
    zIndex: 4,
  },

  logoImage: {
    height: '100%',
    width: '100%',
  },

  logoFallback: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },

  logoFallbackText: {
    color: '#66666C',
    fontSize: 21,
    fontWeight: '800',
  },

  closedOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(18,18,20,0.66)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 6,
  },

  closedOverlayText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 31,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: {
      height: 1,
      width: 0,
    },
    textShadowRadius: 3,
  },

  storeBody: {
    alignItems: 'stretch',
    flex: 1,
    justifyContent: 'center',
    minHeight: 104,
    overflow: 'hidden',
    paddingLeft: 2,
    paddingRight: 0,
  },

  storeBodyClosed: {
    alignItems: 'stretch',
    paddingLeft: 2,
    paddingRight: 0,
  },

  storeNameRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    width: '100%',
  },

  storeNameRowClosed: {
    flexDirection: 'row-reverse',
  },

  storeName: {
    color: '#202024',
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 27,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  storeNameClosed: {
    color: '#202024',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  storeMetaRow: {
    alignItems: 'center',
    direction: 'ltr',
    flexDirection: 'row-reverse',
    gap: 5,
    justifyContent: 'flex-start',
    marginTop: 7,
    minHeight: 24,
    width: '100%',
  },

  ratingStar: {
    color: '#F5A800',
    flexShrink: 0,
    fontSize: 21,
    lineHeight: 23,
  },

  ratingText: {
    color: '#2B2B2F',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'ltr',
  },

  newStoreText: {
    color: '#55555B',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'ltr',
  },

  closedStoreMetaRow: {
    alignItems: 'center',
    direction: 'ltr',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'flex-start',
    marginTop: 7,
    minHeight: 24,
    width: '100%',
  },

  closedRatingGroup: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 5,
  },

  closedRatingStar: {
    color: '#F5A800',
    fontSize: 21,
    lineHeight: 23,
  },

  closedMetaText: {
    color: '#2B2B2F',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
});
