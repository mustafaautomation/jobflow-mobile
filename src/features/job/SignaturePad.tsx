import { useMemo } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { Stroke } from '@/domain/types';
import { useTheme } from '@/ui/theme';

export function SignaturePad({ strokes, onChange }: { strokes: Stroke[]; onChange: (strokes: Stroke[]) => void }) {
  const { colors } = useTheme();
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (event) => {
          const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          onChange([...strokes, { points: [point, { x: point.x + 24, y: point.y - 8 }] }]);
        },
      }),
    [onChange, strokes],
  );

  return (
    <View
      accessibilityLabel="Signature pad"
      testID="signature-pad"
      style={[styles.pad, { borderColor: colors.line, backgroundColor: colors.bgElevated }]}
      {...responder.panHandlers}
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 140">
        {strokes.map((stroke, index) => (
          <Polyline
            key={`${index}-${stroke.points.length}`}
            points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={colors.ink}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { height: 160, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
});
