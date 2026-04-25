import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { palette } from '../../theme/colors';

export default function SkeletonBlock({ width = '100%', height = 14, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          opacity,
          backgroundColor: palette.primary100,
        },
        style,
      ]}
    />
  );
}
