import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState } from '@/controller/provider';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import { errorMessage } from '@/domain/errors';
import { roleLabel } from '@/domain/format';
import { prepareNotifications, presentLocalNotification } from '@/notifications/local';
import { Button, Card, Kicker, Muted, Screen, Title } from '@/ui/components';
import { useTheme, type ThemePreference } from '@/ui/theme';

export function AccountView({
  onOrganizationChanged,
  onSignedOut,
}: {
  onOrganizationChanged: () => void;
  onSignedOut: () => void;
}) {
  const actor = useActor();
  const repo = useRepository();
  const { controller } = useAppState();
  const { colors, preference, setPreference } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [push, setPush] = useState<string>('Not requested');
  const memberships = useSubscribed(
    () => (actor && repo ? repo.listMemberships(actor) : Promise.resolve([])),
    actor ? `memberships:${actor.userId}` : 'none',
  );
  const notifications = useSubscribed(
    () => (actor && repo ? repo.listNotifications(actor) : Promise.resolve([])),
    actor ? `notes:${actor.userId}:${actor.organizationId}` : 'none',
  );

  async function enableAlerts() {
    const result = await prepareNotifications();
    setPush(result.permission === 'granted' || result.permission === 'inbox' ? 'Alerts are on' : `Alerts: ${result.permission}`);
    if (actor && repo && result.token) {
      await repo.registerPushToken(actor, result.token, result.source);
    }
  }

  async function sendTest() {
    if (!actor || !repo) return;
    try {
      const note = await repo.sendTestNotification(actor);
      await presentLocalNotification(note.title, note.body);
      setNotice('Test alert saved in the inbox.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  async function switchOrg(organizationId: string) {
    try {
      await controller?.switchOrganization(organizationId);
      onOrganizationChanged();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }

  return (
    <Screen testID="account-screen">
      <Kicker>Account</Kicker>
      <Title>{actor?.fullName ?? 'Signed out'}</Title>
      <Muted>{actor ? `${roleLabel(actor.role)} · ${actor.email}` : 'Sign in to load a workspace.'}</Muted>
      <Card>
        <Text style={[styles.label, { color: colors.inkMuted }]}>Workspace</Text>
        {memberships.state.status === 'ready'
          ? memberships.state.data.map((membership) => {
              const selected = membership.organizationId === actor?.organizationId;
              return (
                <Pressable
                  key={membership.organizationId}
                  accessibilityRole="button"
                  accessibilityLabel={`${membership.organizationName}, ${roleLabel(membership.role)}`}
                  accessibilityState={{ selected }}
                  onPress={() => void switchOrg(membership.organizationId)}
                  testID={`org-${membership.organizationId}`}
                  style={[styles.org, { borderColor: selected ? colors.primary : colors.line, backgroundColor: colors.bg }]}
                >
                  <Text style={[styles.orgName, { color: colors.ink }]}>{membership.organizationName}</Text>
                  <Muted>
                    {roleLabel(membership.role)} · {membership.organizationCity}
                  </Muted>
                </Pressable>
              );
            })
          : null}
      </Card>
      <Card>
        <Text style={[styles.label, { color: colors.inkMuted }]}>Appearance</Text>
        <View style={styles.segment}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`${item} appearance`}
              accessibilityState={{ selected: preference === item }}
              onPress={() => setPreference(item)}
              testID={`theme-${item}`}
              style={[styles.segmentItem, { backgroundColor: preference === item ? colors.primary : colors.bgSunken }]}
            >
              <Text style={{ color: preference === item ? colors.onPrimary : colors.ink, fontFamily: 'Outfit_600SemiBold' }}>
                {item[0]?.toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={[styles.label, { color: colors.inkMuted }]}>Alerts</Text>
        <Muted>{push}. New assignments land here. On a phone, Jobflow also posts a local notification.</Muted>
        <Button label="Enable alerts" onPress={() => void enableAlerts()} tone="secondary" testID="enable-alerts" />
        <Button label="Send a test alert" onPress={() => void sendTest()} testID="send-test-alert" />
        {notifications.state.status === 'ready' && notifications.state.data.length === 0 ? <Muted>No alerts yet.</Muted> : null}
        {notifications.state.status === 'ready'
          ? notifications.state.data.slice(0, 5).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => actor && repo && void repo.markNotificationRead(actor, item.id)}
              >
                <Text style={[styles.orgName, { color: colors.ink }]}>{item.title}</Text>
                <Muted>{item.body}</Muted>
              </Pressable>
            ))
          : null}
      </Card>
      <Muted testID="data-mode">{controller?.mode === 'supabase' ? 'Connected to Supabase' : 'Demo data on this device'}</Muted>
      {controller?.mode === 'mock' ? (
        <Button
          label="Reset demo workspace"
          tone="secondary"
          testID="reset-demo"
          onPress={() => void controller.resetDemo().then(() => setNotice('Demo workspace reset.'))}
        />
      ) : null}
      {notice ? <Muted>{notice}</Muted> : null}
      <Button
        label="Sign out"
        tone="danger"
        testID="sign-out"
        onPress={() => void controller?.signOut().then(onSignedOut)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4 },
  org: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  orgName: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
