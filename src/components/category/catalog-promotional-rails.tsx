import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SupermarketMediaCard } from '../../services/supermarket-campaign-service';
import type { SupermarketBrandBanner } from '../../services/supermarket-brand-banner-service';

const GAP = 10;
const SIDE = 21;
const AUTO_SWIPE_MS = 3000;

function MediaVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, instance => {
    instance.loop = true;
    instance.muted = true;
  });
  useEffect(() => {
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);
  return <VideoView player={player} style={styles.cover} contentFit="cover" nativeControls={false} />;
}

/** Same 16:9 above-categories placement as the supermarket. Rows are DB-driven. */
export function CatalogMediaCarousel({
  cards, viewportWidth, onPress,
}: {
  cards: SupermarketMediaCard[];
  viewportWidth: number;
  onPress: (card: SupermarketMediaCard) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ordered = useMemo(() => cards, [cards]);
  const width = Math.max(1, viewportWidth - 2 * SIDE);
  const height = Math.round(width * 9 / 16);
  const interval = width + GAP;
  useEffect(() => {
    setIndex(0);
    scroll.current?.scrollTo({ x: 0, animated: false });
  }, [cards.map(card => card.id).join('|'), width]);
  useEffect(() => {
    if (ordered.length < 2 || dragging) return;
    const timer = setInterval(() => {
      setIndex(old => {
        const next = (old + 1) % ordered.length;
        scroll.current?.scrollTo({ x: next * interval, animated: next !== 0 });
        return next;
      });
    }, AUTO_SWIPE_MS);
    return () => clearInterval(timer);
  }, [dragging, interval, ordered.length]);
  if (!ordered.length) return null;
  return (
    <View style={styles.mediaSection}>
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled={false}
        snapToInterval={interval}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={event => {
          setIndex(Math.min(ordered.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval))));
          setDragging(false);
        }}
        onScrollEndDrag={() => setDragging(false)}
        contentContainerStyle={{ gap: GAP, paddingHorizontal: SIDE }}
        style={{ direction: 'ltr' }}
      >
        {ordered.map((card, cardIndex) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityLabel={card.title || 'فتح العرض'}
            onPress={() => onPress(card)}
            style={[styles.mediaCard, { width, height }]}
          >
            {card.mediaType === 'video' && card.videoUrl
              ? <MediaVideo uri={card.videoUrl} active={cardIndex === index} />
              : card.imageUrl
                ? <Image source={{ uri: card.imageUrl }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
                : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Three portrait brand cards with a circular full-bleed brand logo. */
export function CatalogBrandBanners({
  banners, pageWidth, onPress,
}: {
  banners: SupermarketBrandBanner[];
  pageWidth: number;
  onPress: (banner: SupermarketBrandBanner) => void;
}) {
  const width = Math.max(104, Math.min(176, (pageWidth - 32 - 20) / 3));
  if (!banners.length) return null;
  return (
    <View style={styles.brandSection}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRail}>
        {banners.map(banner => (
          <Pressable
            key={banner.id}
            onPress={() => onPress(banner)}
            accessibilityRole="button"
            accessibilityLabel={`عرض منتجات ${banner.title}`}
            style={[styles.brandCard, { width }]}
          >
            <View style={[styles.brandArt, { backgroundColor: banner.backgroundColor, height: Math.round(width * 1.65) }]}>
              <Image
                source={{ uri: banner.heroImageUrl }}
                style={styles.cover}
                contentFit={banner.imageFit}
                cachePolicy="memory-disk"
              />
            </View>
            <View style={[styles.logoCircle, { width: width * 0.70, height: width * 0.70, borderRadius: width * 0.35 }]}>
              {banner.logoUrl
                ? <Image source={{ uri: banner.logoUrl }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
                : <Text style={styles.logoText} numberOfLines={2}>{banner.title}</Text>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: '100%', width: '100%' },
  mediaSection: { marginBottom: 18, width: '100%' },
  mediaCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#F6F4F1' },
  brandSection: { width: '100%', marginTop: 8, marginBottom: 22 },
  brandRail: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  brandCard: { position: 'relative', paddingBottom: 43, alignItems: 'center' },
  brandArt: { width: '100%', overflow: 'hidden', borderRadius: 18 },
  logoCircle: {
    position: 'absolute', bottom: 0, backgroundColor: '#FFFFFF',
    overflow: 'hidden', borderWidth: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#202020', fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
