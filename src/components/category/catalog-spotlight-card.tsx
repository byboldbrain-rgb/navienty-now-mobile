import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ShoppingSpotlight } from '../../services/shopping-spotlight-service';

function SpotlightVideo({ uri, posterUrl }: { uri: string; posterUrl: string | null }) {
  const [frameReady, setFrameReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(uri, video => { video.loop = true; video.muted = true; });
  useEffect(() => {
    const subscription = player.addListener('statusChange', event => {
      if (event.status === 'readyToPlay') player.play();
      if (event.status === 'error') setFailed(true);
    });
    player.play();
    return () => { subscription.remove(); player.pause(); };
  }, [player]);
  return (
    <View style={styles.background} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.background}
        nativeControls={false}
        contentFit="cover"
        surfaceType="textureView"
        onFirstFrameRender={() => setFrameReady(true)}
      />
      {!frameReady && posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.background} contentFit="cover" />
      ) : !frameReady && !failed ? <ActivityIndicator color="white" style={styles.loader} /> : null}
    </View>
  );
}

export function CatalogSpotlightCard({
  card, onPress,
}: {
  card: ShoppingSpotlight;
  onPress: () => void;
}) {
  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityLabel={card.titleAr}
        onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.96 }]}>
        {card.mediaType === 'video'
          ? <SpotlightVideo uri={card.mediaUrl} posterUrl={card.posterUrl} />
          : <Image source={{ uri: card.mediaUrl }} style={styles.background}
              contentFit="cover" cachePolicy="memory-disk" />}
        <Svg pointerEvents="none" style={styles.background} width="100%" height="100%">
          <Defs>
            <LinearGradient id="shopping-spotlight-shade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#111111" stopOpacity={0.55} />
              <Stop offset="40%" stopColor="#111111" stopOpacity={0.05} />
              <Stop offset="70%" stopColor="#111111" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#111111" stopOpacity={0.44} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#shopping-spotlight-shade)" />
        </Svg>
        <View style={styles.copy} pointerEvents="none">
          {card.eyebrowAr ? <Text style={styles.eyebrow} numberOfLines={2}>{card.eyebrowAr}</Text> : null}
          <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>{card.titleAr}</Text>
        </View>
        <View style={styles.button} pointerEvents="none">
          <Text style={styles.buttonText}>{card.buttonLabelAr}</Text>
        </View>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 26 },
  card: { width: '100%', aspectRatio: 0.92, borderRadius: 23, overflow: 'hidden', backgroundColor: '#1F2421', position: 'relative' },
  background: { ...StyleSheet.absoluteFillObject },
  loader: { position: 'absolute', top: '50%', left: '50%' },
  copy: { position: 'absolute', top: 28, right: 23, left: 23, alignItems: 'flex-end' },
  eyebrow: { color: 'white', fontSize: 19, fontWeight: '600', lineHeight: 26, textAlign: 'right', writingDirection: 'rtl' },
  title: { color: 'white', fontSize: 40, fontWeight: '900', lineHeight: 49, textAlign: 'right', writingDirection: 'rtl' },
  button: { position: 'absolute', left: 18, bottom: 18, backgroundColor: '#00B956', paddingHorizontal: 26, minHeight: 52, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '800', writingDirection: 'rtl' },
});
