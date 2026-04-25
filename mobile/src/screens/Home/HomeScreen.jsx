import React from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../theme/colors';
const AVATAR_GRADIENT = ['#7c3aed', '#c026d3'];

const HERO_ITEMS = [
  { emoji: '👕', label: 'White Tee', bg: '#f0f0f0' },
  { emoji: '👗', label: 'Floral Dress', bg: '#fce4ec' },
  { emoji: '👟', label: 'Sneakers', bg: '#e3f2fd' },
  { emoji: '👔', label: 'Dress Shirt', bg: '#e8f5e9' },
  { emoji: '🧥', label: 'Overcoat', bg: '#f3e5f5' },
  { emoji: '👜', label: 'Tote Bag', bg: '#fff3e0' },
];

const HOW_IT_WORKS = [
  {
    number: '01',
    emoji: '📸',
    title: 'Upload Your Clothes',
    description:
      'Photograph your clothing and upload it. ClosetMate automatically strips the background and uses AI to detect the item name, season, and weather classification.',
  },
  {
    number: '02',
    emoji: '✨',
    title: 'Generate AI Outfits',
    description:
      'Choose your occasion, season, and style preference. The AI engine picks the best combinations from your wardrobe and gives each outfit a cohesion score with reasoning.',
  },
  {
    number: '03',
    emoji: '🌍',
    title: 'Share & Discover',
    description:
      'Publish your favourite outfits to the community feed. Collect emoji reactions, star ratings, and comments and get inspired by looks from other users.',
  },
];

const FEATURE_BLOCKS = [
  {
    emoji: '🗂️',
    title: 'Smart Wardrobe Management',
    description: 'Upload photos of your clothes and let ClosetMate organize each piece with item names and wardrobe context.',
    bullets: ['Auto background removal', 'AI item naming', 'Season-ready organization'],
  },
  {
    emoji: '🤖',
    title: 'AI-Powered Outfit Generation',
    description: 'Pick your occasion and style, then let the AI build combinations directly from your own wardrobe.',
    bullets: ['Occasion filters', 'Style preferences', 'Combination scoring'],
  },
  {
    emoji: '🌐',
    title: 'Community Style Feed',
    description: 'Share outfits, react to other looks, and discover fresh inspiration from the ClosetMate community.',
    bullets: ['Outfit reactions', 'Ratings and comments', 'Shared inspiration'],
  },
];

export default function HomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [featuresModalVisible, setFeaturesModalVisible] = React.useState(false);
  const [howItWorksModalVisible, setHowItWorksModalVisible] = React.useState(false);
  const introAnim = React.useRef(new Animated.Value(0)).current;
  const panelAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnimPrimary = React.useRef(new Animated.Value(0)).current;
  const glowAnimSecondary = React.useRef(new Animated.Value(0)).current;
  const headlineFloatAnim = React.useRef(new Animated.Value(0)).current;
  const wardrobeFloatAnim = React.useRef(new Animated.Value(0)).current;
  const dotPulseAnim = React.useRef(new Animated.Value(0)).current;
  const heroCardAnims = React.useRef(HERO_ITEMS.map(() => new Animated.Value(0))).current;
  const isTablet = width >= 768;
  const isDesktop = width >= 980;
  const horizontalPadding = isTablet ? Math.min(width * 0.08, 54) : 20;
  const panelWidth = isDesktop ? 340 : Math.min(width - horizontalPadding * 2, 340);

  React.useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(introAnim, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 620,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        80,
        heroCardAnims.map((anim, index) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 380,
            delay: 150 + index * 12,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
    ]);

    const pulsePrimary = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimPrimary, {
          toValue: 1,
          duration: 2900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimPrimary, {
          toValue: 0,
          duration: 2900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseSecondary = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimSecondary, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimSecondary, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const headlineFloat = Animated.loop(
      Animated.sequence([
        Animated.timing(headlineFloatAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(headlineFloatAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const wardrobeFloat = Animated.loop(
      Animated.sequence([
        Animated.timing(wardrobeFloatAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wardrobeFloatAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulseAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    pulsePrimary.start();
    pulseSecondary.start();
    headlineFloat.start();
    wardrobeFloat.start();
    dotPulse.start();

    return () => {
      pulsePrimary.stop();
      pulseSecondary.stop();
      headlineFloat.stop();
      wardrobeFloat.stop();
      dotPulse.stop();
    };
  }, [dotPulseAnim, glowAnimPrimary, glowAnimSecondary, headlineFloatAnim, heroCardAnims, introAnim, panelAnim, wardrobeFloatAnim]);

  const introStyle = {
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  const panelStyle = {
    opacity: panelAnim,
    transform: [
      {
        translateY: panelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  };

  const glowPrimaryStyle = {
    opacity: glowAnimPrimary.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 0.95],
    }),
    transform: [
      {
        scale: glowAnimPrimary.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1.07],
        }),
      },
    ],
  };

  const glowSecondaryStyle = {
    opacity: glowAnimSecondary.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0.82],
    }),
    transform: [
      {
        scale: glowAnimSecondary.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.04],
        }),
      },
    ],
  };

  const headlineFloatStyle = {
    transform: [
      {
        translateY: headlineFloatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -7],
        }),
      },
      {
        scale: headlineFloatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.01],
        }),
      },
    ],
  };

  const wardrobeFloatStyle = {
    transform: [
      {
        translateY: wardrobeFloatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
      {
        scale: wardrobeFloatAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.008],
        }),
      },
    ],
  };

  const eyebrowDotBlinkStyle = {
    opacity: dotPulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    }),
    transform: [
      {
        scale: dotPulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.08],
        }),
      },
    ],
  };

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.heroGlow, styles.heroGlowPrimary, glowPrimaryStyle]} />
      <Animated.View style={[styles.heroGlow, styles.heroGlowSecondary, glowSecondaryStyle]} />
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) + 28 }}>
          <View style={[styles.heroSection, { paddingHorizontal: horizontalPadding, paddingTop: 18 }]}>
            <View style={styles.dotGrid} />

            <View style={[styles.heroContent, isDesktop && styles.heroContentWide]}>
              <Animated.View style={[styles.heroCopy, introStyle]}>
                <View style={styles.eyebrowRow}>
                  <Animated.View style={[styles.eyebrowDot, eyebrowDotBlinkStyle]} />
                  <Text style={styles.eyebrowText}>AI-Powered Style</Text>
                </View>

                <Animated.Text style={[styles.headline, isTablet && styles.headlineLarge, headlineFloatStyle]}>
                  Stop Guessing{'\n'}
                  <Text style={styles.gradientHeadline}>What To Wear.</Text>
                </Animated.Text>

                <Text style={styles.subheadline}>
                  ClosetMate digitizes your wardrobe and uses AI to suggest perfect outfits every single day.
                </Text>

                <View style={styles.ctaRow}>
                  <Pressable
                    onPress={() => setFeaturesModalVisible(true)}
                    style={({ pressed }) => [
                      styles.ctaButton,
                      styles.primaryCta,
                      pressed && styles.ctaPressed,
                    ]}
                  >
                    <Text style={styles.primaryCtaText}>Features</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setHowItWorksModalVisible(true)}
                    style={({ pressed }) => [
                      styles.ctaButton,
                      styles.secondaryCta,
                      pressed && styles.ctaPressed,
                    ]}
                  >
                    <Text style={styles.secondaryCtaText}>See How It Works</Text>
                  </Pressable>
                </View>
              </Animated.View>

              <Animated.View style={[styles.heroPanel, { width: panelWidth }, panelStyle, wardrobeFloatStyle]}>
                <View style={styles.heroPanelHeader}>
                  <Text style={styles.heroPanelTitle}>My Wardrobe</Text>
                  <View style={styles.panelPill}>
                    <Text style={styles.panelPillText}>12 items</Text>
                  </View>
                </View>

                <View style={styles.heroGrid}>
                  {HERO_ITEMS.map((item, index) => (
                    <Animated.View
                      key={item.label}
                      style={[
                        styles.heroGridCardWrap,
                        {
                          opacity: heroCardAnims[index],
                          transform: [
                            {
                              translateY: heroCardAnims[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0],
                              }),
                            },
                            {
                              scale: heroCardAnims[index].interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.95, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.heroGridCard,
                          { backgroundColor: item.bg },
                          pressed && styles.heroGridCardPressed,
                        ]}
                      >
                        <Text style={styles.heroGridEmoji}>{item.emoji}</Text>
                        <Text style={styles.heroGridLabel}>{item.label}</Text>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>

                <Text style={styles.heroPanelFooter}>3 AI combinations ready to wear</Text>
              </Animated.View>
            </View>

            <View style={styles.showcaseSection}>
              <OutfitShowcaseCard />
              <CommunityShowcaseCard />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={featuresModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFeaturesModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFeaturesModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Everything Your Wardrobe Needs</Text>
              <Pressable onPress={() => setFeaturesModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              {FEATURE_BLOCKS.map((feature) => (
                <FeaturePanel
                  key={feature.title}
                  emoji={feature.emoji}
                  title={feature.title}
                  description={feature.description}
                  bullets={feature.bullets}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={howItWorksModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHowItWorksModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHowItWorksModalVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Get Dressed Smarter in 3 Steps</Text>
              <Pressable onPress={() => setHowItWorksModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <View style={styles.stepsVerticalList}>
                {HOW_IT_WORKS.map((step, index) => (
                  <View key={step.number} style={styles.stepVerticalItem}>
                    <HowItWorksCard step={step} />
                    {index < HOW_IT_WORKS.length - 1 ? <View style={styles.stepConnectorVertical} /> : null}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HowItWorksCard({ step }) {
  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepNumber}>{step.number}</Text>
      <Text style={styles.stepEmoji}>{step.emoji}</Text>
      <Text style={styles.stepTitle}>{step.title}</Text>
      <Text style={styles.stepDescription}>{step.description}</Text>
    </View>
  );
}

function FeaturePanel({ emoji, title, description, bullets }) {
  return (
    <View style={styles.featurePanel}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
      <View style={styles.featureBulletList}>
        {bullets.map((bullet) => (
          <View key={bullet} style={styles.featureBulletRow}>
            <Text style={styles.featureBulletMark}>✓</Text>
            <Text style={styles.featureBulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OutfitShowcaseCard() {
  return (
    <View style={styles.showcaseCard}>
      <Text style={styles.showcaseTitle}>✨ AI Generated Outfit</Text>

      <View style={styles.outfitRow}>
        <View style={styles.outfitPiece}>
          <Text style={styles.outfitPieceEmoji}>👔</Text>
        </View>
        <Text style={styles.outfitPlus}>+</Text>
        <View style={styles.outfitPiece}>
          <Text style={styles.outfitPieceEmoji}>👖</Text>
        </View>
        <Text style={styles.outfitPlus}>+</Text>
        <View style={styles.outfitPiece}>
          <Text style={styles.outfitPieceEmoji}>👟</Text>
        </View>
      </View>

      <View style={styles.outfitTags}>
        <View style={[styles.tag, styles.tagBlue]}>
          <Text style={styles.tagBlueText}>Business Casual</Text>
        </View>
        <View style={[styles.tag, styles.tagGreen]}>
          <Text style={styles.tagGreenText}>Spring</Text>
        </View>
        <View style={[styles.tag, styles.tagPurple]}>
          <Text style={styles.tagPurpleText}>Work</Text>
        </View>
      </View>

      <View style={styles.scoreBox}>
        <Text style={styles.scoreLabel}>Cohesion Score</Text>
        <Text style={styles.scoreValue}>9 / 10</Text>
      </View>

      <View style={styles.reasonBox}>
        <Text style={styles.reasonText}>
          {'"'}The structured shirt and slim trousers balance each other perfectly for a sharp, effortless office look.{'"'}
        </Text>
      </View>
    </View>
  );
}

function CommunityShowcaseCard() {
  return (
    <View style={styles.showcaseCard}>
      <View style={styles.communityHeader}>
        <LinearGradient
          colors={AVATAR_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>S</Text>
        </LinearGradient>
        <View>
          <Text style={styles.communityName}>@sarah_styles</Text>
          <Text style={styles.communityTime}>2h ago</Text>
        </View>
      </View>

      <View style={styles.communityOutfitBox}>
        <Text style={styles.communityOutfitEmoji}>👗</Text>
        <Text style={styles.communityOutfitEmoji}>👠</Text>
        <Text style={styles.communityOutfitEmoji}>👜</Text>
      </View>

      <View style={styles.communityStatsRow}>
        <View style={styles.communityStat}>
          <Text style={styles.communityStatEmoji}>👍</Text>
          <Text style={styles.communityMeta}>24</Text>
        </View>
        <View style={styles.communityStat}>
          <Text style={styles.communityStatEmoji}>❤️</Text>
          <Text style={styles.communityMeta}>18</Text>
        </View>
        <View style={styles.communityStat}>
          <Text style={styles.communityStatEmoji}>🔥</Text>
          <Text style={styles.communityMeta}>12</Text>
        </View>
        <View style={styles.communityStat}>
          <Text style={styles.communityStatEmoji}>✨</Text>
          <Text style={styles.communityMeta}>9</Text>
        </View>
      </View>
      <View style={styles.communityFooterRow}>
        <View style={styles.communityStat}>
          <Text style={styles.communityStars}>⭐ 4.8</Text>
        </View>
        <View style={styles.communityStat}>
          <Text style={styles.communityComments}>💬 14 comments</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#181130',
  },
  heroSection: {
    paddingBottom: 34,
    backgroundColor: '#181130',
  },
  heroGlow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
  },
  heroGlowPrimary: {
    width: 420,
    height: 420,
    top: 120,
    right: -90,
    backgroundColor: 'rgba(142, 55, 223, 0.26)',
  },
  heroGlowSecondary: {
    width: 340,
    height: 340,
    top: 320,
    left: -120,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  dotGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.22,
    backgroundColor: '#181130',
  },
  heroContent: {
    gap: 28,
  },
  heroContentWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 16,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primaryLight,
  },
  eyebrowText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '800',
    color: palette.primaryLighter,
  },
  headline: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '900',
    color: palette.textOnDark,
    letterSpacing: -1.6,
  },
  headlineLarge: {
    fontSize: 54,
    lineHeight: 56,
  },
  gradientHeadline: {
    color: palette.primaryLight,
  },
  subheadline: {
    maxWidth: 520,
    fontSize: 16,
    lineHeight: 27,
    color: palette.textOnDarkMuted,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  ctaButton: {
    minWidth: 150,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryCta: {
    backgroundColor: palette.primaryLight,
  },
  secondaryCta: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.textOnDark,
  },
  heroPanel: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: palette.panelGlass,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroPanelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.textOnDark,
  },
  panelPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(205, 182, 255, 0.2)',
  },
  panelPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primaryLighter,
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroGridCardWrap: {
    width: '31%',
    minWidth: 88,
  },
  heroGridCard: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  heroGridCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  heroGridEmoji: {
    fontSize: 30,
  },
  heroGridLabel: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: palette.text,
  },
  heroPanelFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: palette.primaryLighter,
  },
  showcaseSection: {
    marginTop: 16,
    gap: 14,
  },
  showcaseCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#e8e2f4',
    borderWidth: 1.2,
    borderColor: '#d8d2e3',
  },
  showcaseTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7b3fd0',
  },
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  outfitPiece: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f6f8',
    borderWidth: 1,
    borderColor: '#dadde1',
  },
  outfitPieceEmoji: {
    fontSize: 30,
  },
  outfitPlus: {
    fontSize: 30,
    fontWeight: '700',
    color: '#98a1ab',
  },
  outfitTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagBlue: {
    backgroundColor: '#cde6f6',
  },
  tagBlueText: {
    color: '#0b6aa9',
    fontWeight: '700',
  },
  tagGreen: {
    backgroundColor: '#ccefdc',
  },
  tagGreenText: {
    color: '#16a34a',
    fontWeight: '700',
  },
  tagPurple: {
    backgroundColor: '#ddd0f3',
  },
  tagPurpleText: {
    color: '#5b2ab6',
    fontWeight: '700',
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f4f5f7',
    borderWidth: 1,
    borderColor: '#dadde1',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#69737d',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#8a3cdc',
  },
  reasonBox: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f4f5f7',
    borderLeftWidth: 4,
    borderLeftColor: '#b99ef1',
  },
  reasonText: {
    fontSize: 16,
    lineHeight: 30,
    color: '#5e6974',
    fontStyle: 'italic',
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  communityName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101623',
  },
  communityTime: {
    fontSize: 16,
    color: '#8f98a1',
  },
  communityOutfitBox: {
    borderRadius: 16,
    paddingVertical: 16,
    backgroundColor: '#f4f5f7',
    borderWidth: 1,
    borderColor: '#dadde1',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  communityOutfitEmoji: {
    fontSize: 34,
  },
  communityStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  communityFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  communityStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  communityStatEmoji: {
    fontSize: 16,
  },
  communityMeta: {
    fontSize: 14,
    color: '#646d77',
  },
  communityStars: {
    fontSize: 16,
    fontWeight: '700',
    color: '#646d77',
  },
  communityComments: {
    fontSize: 14,
    color: '#919aa3',
  },
  section: {
    paddingTop: 36,
    paddingBottom: 8,
    backgroundColor: '#f7f3fb',
  },
  sectionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.primarySoft,
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: palette.text,
    marginBottom: 22,
    letterSpacing: -1,
  },
  stepsVerticalList: {
    marginTop: 4,
    gap: 2,
    alignItems: 'center',
  },
  stepVerticalItem: {
    width: '100%',
    alignItems: 'center',
  },
  stepCard: {
    backgroundColor: '#ede6fb',
    borderWidth: 1,
    borderColor: '#d3c0f9',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#5b21b6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  stepNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: palette.primary,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  stepEmoji: {
    fontSize: 52,
    marginBottom: 18,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 25,
    color: palette.textMuted,
    textAlign: 'center',
  },
  stepConnectorVertical: {
    width: 0,
    height: 16,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderColor: palette.borderStrong,
    borderStyle: 'dashed',
  },
  featureColumn: {
    gap: 16,
  },
  featurePanel: {
    backgroundColor: '#ede6fb',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.2,
    borderColor: '#d3c0f9',
    shadowColor: '#5b21b6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  featureEmoji: {
    fontSize: 30,
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 23,
    color: palette.textMuted,
    marginBottom: 14,
  },
  featureBulletList: {
    gap: 10,
  },
  featureBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureBulletMark: {
    fontSize: 14,
    fontWeight: '900',
    color: palette.primary,
  },
  featureBulletText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 9, 24, 0.6)',
  },
  modalSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#f3eefc',
    borderTopWidth: 1,
    borderColor: '#d9caf9',
    paddingTop: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: palette.text,
    marginRight: 10,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ece4ff',
  },
  modalContent: {
    paddingHorizontal: 18,
    paddingBottom: 26,
    gap: 12,
  },
});
