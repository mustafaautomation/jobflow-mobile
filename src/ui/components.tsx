import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { InvoiceStatus, JobStatus, MemberStatus, Priority } from '@/domain/types';
import { invoiceLabel, memberStatusLabel, statusLabel } from '@/domain/format';
import { useTheme, type Palette } from '@/ui/theme';
import { useAppState } from '@/controller/provider';

export function Screen({
  children,
  scroll = true,
  footer,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scroll} testID={testID}>
      {children}
    </View>
  );
  return (
    <View style={[styles.frame, { backgroundColor: colors.frame }]}>
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[styles.column, webColumn, { backgroundColor: colors.bg }]}
      >
        <OfflineBanner />
        <View style={styles.flex}>{body}</View>
        {footer ? <View style={[styles.footer, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

export function OfflineBanner() {
  const { colors } = useTheme();
  const { snapshot, controller } = useAppState();
  if (!snapshot.offline) return null;
  const copy =
    controller?.mode === 'mock'
      ? 'Offline. This demo stays on the device.'
      : 'Offline. Showing the last schedule saved on this device.';
  return (
    <View style={[styles.banner, { backgroundColor: colors.warningSoft }]} accessibilityRole="text" testID="offline-banner">
      <Text style={[styles.bannerText, { color: colors.warning }]}>{copy}</Text>
    </View>
  );
}

export function Title({ children, testID }: { children: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" testID={testID} style={[styles.title, { color: colors.ink }]}>
      {children}
    </Text>
  );
}

export function Kicker({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.kicker, { color: colors.primary }]}>{children}</Text>;
}

export function Muted({ children, style, testID }: { children: ReactNode; style?: StyleProp<TextStyle>; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} style={[styles.muted, { color: colors.inkMuted }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const palette = buttonPalette(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border, opacity: disabled ? 0.55 : 1 },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: palette.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  multiline,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.inkMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        testID={testID}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize !== 'none'}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { color: colors.ink, backgroundColor: colors.bgElevated, borderColor: colors.line },
        ]}
      />
    </View>
  );
}

export function Card({ children, style, onPress, testID, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; label?: string }) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.line }, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={testID} style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function StatusPill({ status }: { status: JobStatus }) {
  const { colors } = useTheme();
  const tone = jobTone(colors, status);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.ink }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function MemberPill({ status }: { status: MemberStatus }) {
  const { colors } = useTheme();
  const tone = memberTone(colors, status);
  return (
    <View style={styles.memberRow}>
      <View style={[styles.dot, { backgroundColor: tone.ink }]} />
      <Text style={[styles.pillText, { color: tone.ink }]}>{memberStatusLabel(status)}</Text>
    </View>
  );
}

export function InvoicePill({ status }: { status: InvoiceStatus }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: status === 'paid' ? colors.successSoft : colors.bgSunken }]}>
      <Text style={[styles.pillText, { color: status === 'paid' ? colors.success : colors.ink }]}>{invoiceLabel(status)}</Text>
    </View>
  );
}

export function UrgentTag({ priority }: { priority: Priority }) {
  const { colors } = useTheme();
  if (priority !== 'urgent') return null;
  return (
    <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
      <Text style={[styles.pillText, { color: colors.warning }]}>Urgent</Text>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.state} accessibilityRole="progressbar" accessibilityLabel={label} testID="loading-state">
      <ActivityIndicator color={colors.primary} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function EmptyState({ title, body, actionLabel, onAction, testID }: { title: string; body: string; actionLabel?: string; onAction?: () => void; testID?: string }) {
  return (
    <View style={styles.state} testID={testID ?? 'empty-state'}>
      <Title>{title}</Title>
      <Muted>{body}</Muted>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.state} testID="error-state">
      <Title>Something needs another look</Title>
      <Muted>{message}</Muted>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export function RowLink({ title, detail, onPress, testID }: { title: string; detail: string; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      testID={testID}
      style={[styles.rowLink, { borderColor: colors.line, backgroundColor: colors.bgElevated }]}
    >
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{title}</Text>
        <Muted>{detail}</Muted>
      </View>
      <Text style={[styles.chevron, { color: colors.primary }]}>›</Text>
    </Pressable>
  );
}

function buttonPalette(colors: Palette, tone: 'primary' | 'secondary' | 'quiet' | 'danger') {
  if (tone === 'secondary') return { bg: colors.bgElevated, pressed: colors.bgSunken, ink: colors.ink, border: colors.line };
  if (tone === 'quiet') return { bg: 'transparent', pressed: colors.bgSunken, ink: colors.primary, border: 'transparent' };
  if (tone === 'danger') return { bg: colors.dangerSoft, pressed: colors.dangerSoft, ink: colors.danger, border: 'transparent' };
  return { bg: colors.primary, pressed: colors.primaryPressed, ink: colors.onPrimary, border: colors.primary };
}

function jobTone(colors: Palette, status: JobStatus) {
  switch (status) {
    case 'in_progress':
      return { bg: colors.successSoft, ink: colors.success };
    case 'en_route':
      return { bg: colors.infoSoft, ink: colors.info };
    case 'paused':
      return { bg: colors.accentSoft, ink: colors.warning };
    case 'completed':
      return { bg: colors.bgSunken, ink: colors.inkMuted };
    case 'cancelled':
      return { bg: colors.dangerSoft, ink: colors.danger };
    default:
      return { bg: colors.bgSunken, ink: colors.ink };
  }
}

function memberTone(colors: Palette, status: MemberStatus) {
  switch (status) {
    case 'on_job':
      return { ink: colors.success };
    case 'en_route':
      return { ink: colors.info };
    case 'paused':
      return { ink: colors.warning };
    case 'offline':
      return { ink: colors.inkMuted };
    default:
      return { ink: colors.primary };
  }
}

const webColumn = Platform.OS === 'web' ? { maxWidth: 440, width: '100%' as const, alignSelf: 'center' as const } : null;

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%' },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 14, paddingBottom: 120 },
  footer: { padding: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  banner: { paddingHorizontal: 20, paddingVertical: 8 },
  bannerText: { fontFamily: 'Outfit_500Medium', fontSize: 13 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 32, lineHeight: 36 },
  kicker: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  muted: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1 },
  buttonLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: 'Outfit_500Medium', fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  inputMulti: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: 'Outfit_600SemiBold', fontSize: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  state: { gap: 12, paddingVertical: 24 },
  rowLink: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  chevron: { fontSize: 28, lineHeight: 28 },
});
