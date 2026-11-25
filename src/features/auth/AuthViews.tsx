import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAppState } from '@/controller/provider';
import { errorMessage } from '@/domain/errors';
import type { DemoPersona } from '@/domain/types';
import { Button, Kicker, Muted, Screen, TextField, Title } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function WelcomeView({ onSignedIn, onSignIn }: { onSignedIn: () => void; onSignIn: () => void }) {
  const { colors } = useTheme();
  const { controller, snapshot } = useAppState();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(snapshot.authError);
  const demo = controller?.mode !== 'supabase';

  async function choose(persona: DemoPersona) {
    try {
      await controller?.enterDemo(persona);
      onSignedIn();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen testID="welcome-screen">
      <View style={[styles.markWrap, { backgroundColor: colors.bgElevated, borderColor: colors.line }]}>
        <Mark />
      </View>
      <Kicker>Jobflow</Kicker>
      <Title>The day, in order.</Title>
      <Muted>
        Today’s calls, the drive between them, and the paperwork at the door. Built for HVAC crews who would rather not carry the clipboard.
      </Muted>
      {error ? <Text style={{ color: colors.danger, fontFamily: 'Outfit_500Medium' }}>{error}</Text> : null}
      {demo ? (
        <Button label="Try the demo" onPress={() => setOpen(true)} testID="welcome-try-demo" />
      ) : (
        <Muted>This build is connected to your Jobflow workspace. Sign in with your work email.</Muted>
      )}
      <Button label="Sign in with email" onPress={onSignIn} tone="secondary" testID="welcome-sign-in" />
      {open ? (
        <View style={[styles.sheet, { backgroundColor: colors.bgElevated, borderColor: colors.line }]} accessibilityViewIsModal>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>Open the demo workspace</Text>
          <Muted>Both people also belong to Summit Mechanical. Switch companies from Account.</Muted>
          <Button label="Alex Rivera · Technician" onPress={() => void choose('alex')} testID="persona-alex" />
          <Button label="Jordan Hale · Dispatcher" onPress={() => void choose('jordan')} tone="secondary" testID="persona-jordan" />
        </View>
      ) : null}
    </Screen>
  );
}

export function SignInView({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const { controller } = useAppState();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { colors } = useTheme();

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await controller?.sendMagicLink(email);
      onSent();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen testID="sign-in-screen">
      <Kicker>Sign in</Kicker>
      <Title>Use your work email.</Title>
      <Muted>
        {controller?.mode === 'mock'
          ? 'Demo inboxes: alex.rivera@harborpine.demo and jordan.hale@harborpine.demo. We’ll show the link here instead of sending mail.'
          : 'We’ll email a sign-in link. No password is stored on this phone.'}
      </Muted>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        testID="sign-in-email"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {error ? <Text style={{ color: colors.danger, fontFamily: 'Outfit_500Medium' }}>{error}</Text> : null}
      <Button label={pending ? 'Sending…' : 'Send magic link'} onPress={() => void submit()} disabled={pending} testID="sign-in-submit" />
      <Button label="Back" onPress={onBack} tone="quiet" testID="sign-in-back" />
    </Screen>
  );
}

export function CheckEmailView({ onSignedIn, onBack }: { onSignedIn: () => void; onBack: () => void }) {
  const { controller, snapshot } = useAppState();
  const pending = snapshot.pendingMagicLink;
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();

  async function openLink() {
    if (!pending?.devToken) return;
    try {
      await controller?.consumeMagicLink(pending.devToken);
      onSignedIn();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Screen testID="check-email-screen">
      <Kicker>Check your email</Kicker>
      <Title>The link is on its way.</Title>
      <Muted>
        {pending
          ? `We prepared a sign-in link for ${pending.email}.`
          : 'Enter your email again if you don’t see a link waiting here.'}
      </Muted>
      {controller?.mode === 'mock' && pending?.devToken ? (
        <Button label="Open magic link" onPress={() => void openLink()} testID="open-magic-link" />
      ) : (
        <Muted>On a connected build, tap the link in the email. It returns you to Jobflow.</Muted>
      )}
      {error ? (
        <Text testID="auth-error" style={{ color: colors.danger, fontFamily: 'Outfit_500Medium' }}>
          {error}
        </Text>
      ) : null}
      <Button label="Use a different email" onPress={onBack} tone="quiet" testID="check-email-back" />
    </Screen>
  );
}

function Mark() {
  const { colors } = useTheme();
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56" accessibilityLabel="Jobflow mark">
      <Rect width="56" height="56" rx="16" fill={colors.primary} />
      <Path d="M16 40 L28 16 L40 40" stroke={colors.onPrimary} strokeWidth="3" fill="none" />
      <Circle cx="28" cy="34" r="4" fill={colors.accent} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  markWrap: { width: 72, height: 72, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  sheetTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22 },
});
