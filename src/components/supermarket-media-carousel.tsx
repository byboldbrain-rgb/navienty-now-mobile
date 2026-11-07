import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Image from './ui/app-image';
import type { SupermarketMediaCard } from '../services/supermarket-media-card-service';

const SIDE_INSET = 22;
const CARD_GAP = 10;

type Props = {
  cards: SupermarketMediaCard[];
  viewportWidth: number;
  onCategoryPress?: (key: string) => void;
};

function PlayingVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
    return () => player.pause();
  }, [player]);

  return (
    <View pointerEvents="none" style={styles.videoLayer}>
      <VideoView
        player={player}
        style={styles.full}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
    </View>
  );
}

/** 16:9 hero carousel ABOVE category tiles, separate from lower banners. */
export default function SupermarketMediaCarousel({
  cards,
  viewportWidth,
  onCategoryPress,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const startIndex = cards.length >= 3 ? 1 : 0;
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const visibleIndex = Math.min(activeIndex, Math.max(0, cards.length - 1));
  const width = Math.max(1, viewportWidth - SIDE_INSET * 2);
  const height = Math.round(width * 9 / 16);
  const interval = width + CARD_GAP;
  const ids = cards.map((card) => card.id).join('|');

  useEffect(() => {
    setActiveIndex(startIndex);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: startIndex * interval,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [ids, startIndex, interval]);

  if (cards.length === 0) return null;

  const updateIndex = (x: number) => {
    setActiveIndex(
      Math.max(0, Math.min(cards.length - 1, Math.round(x / interval))),
    );
  };

  return (
    <View style={styles.section} accessibilityLabel="عروض ماركت نافينتي">
      <ScrollView
        ref={scrollRef}
        horizontal
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        disableIntervalMomentum
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.rail, { paddingHorizontal: SIDE_INSET }]}
        onMomentumScrollEnd={(event) => updateIndex(event.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(event) => updateIndex(event.nativeEvent.contentOffset.x)}
      >
        {cards.map((card, index) => {
          const active = index === visibleIndex;
          const isVideo = card.mediaType === 'video';
          const preview = isVideo ? card.posterUrl : card.mediaUrl;
          const clickable = Boolean(card.categoryKey && onCategoryPress);
          return (
            <Pressable
              key={card.id}
              style={[styles.card, { width, height }]}
              disabled={!clickable}
              onPress={() => {
                if (card.categoryKey) onCategoryPress?.(card.categoryKey);
              }}
              accessibilityRole={clickable ? 'button' : 'image'}
              accessibilityLabel={card.title || 'عرض رقم ' + (index + 1)}
            >
              {preview ? (
                <Image
                  source={{ uri: preview }}
                  resizeMode="cover"
                  style={styles.full}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.fallback}>
                  <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={34} color="#7E8E82" />
                </View>
              )}
              {isVideo && active ? <PlayingVideo uri={card.mediaUrl} /> : null}
              {isVideo && !active ? (
                <View pointerEvents="none" style={styles.playIcon}>
                  <Ionicons name="play" size={17} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {cards.length > 1 ? (
        <View style={styles.dots} accessibilityLabel="مؤشرات الكروت">
          {cards.map((card, index) => (
            <View
              key={'dot-' + card.id}
              style={[styles.dot, index === visibleIndex && styles.activeDot]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingTop: 10,
    paddingBottom: 20,
  },
  scroll: {
    width: '100%',
    direction: 'ltr',
  },
  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    direction: 'ltr',
    gap: CARD_GAP,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#F5F0E8',
    overflow: 'hidden',
  },
  full: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLayer: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  playIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 99,
    width: 34,
    height: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#D0D6D2',
  },
  activeDot: {
    width: 20,
    backgroundColor: '#00B956',
  },
});
