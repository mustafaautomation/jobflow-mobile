import { StyleSheet, Text, View } from 'react-native';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import { formatMiles, mapsRouteUrl } from '@/domain/geo';
import { formatTime } from '@/domain/format';
import { Button, EmptyState, ErrorState, Kicker, LoadingState, Muted, Screen, Title } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function RouteView({ onOpenJob, onOpenUrl }: { onOpenJob: (jobId: string) => void; onOpenUrl: (url: string) => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.listMyRoute(actor) : Promise.resolve([])),
    actor ? `route:${actor.memberId}:${actor.organizationId}` : 'none',
  );
  const stops = state.status === 'ready' ? state.data : [];
  const url = mapsRouteUrl(stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })));

  return (
    <Screen testID="route-screen">
      <Kicker>Route</Kicker>
      <Title>Stops in drive order.</Title>
      {state.status === 'loading' ? <LoadingState label="Loading the route" /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} onRetry={retry} /> : null}
      {state.status === 'ready' && stops.length === 0 ? (
        <EmptyState title="No stops yet" body="When a job lands on your name, it shows up here in order." actionLabel="Check again" onAction={retry} />
      ) : null}
      {stops.map((stop, index) => (
        <View key={stop.id} style={[styles.stop, { borderColor: colors.line }]}>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{index + 1}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.name, { color: colors.ink }]} onPress={() => onOpenJob(stop.id)}>
              {stop.customerName}
            </Text>
            <Muted>
              {formatTime(stop.scheduledStart)} · {stop.distanceFromPreviousMiles == null ? 'Start of the day' : formatMiles(stop.distanceFromPreviousMiles)}
            </Muted>
            <Muted>{stop.addressLine}</Muted>
          </View>
        </View>
      ))}
      {url ? <Button label="Open full route in Maps" onPress={() => onOpenUrl(url)} testID="open-route" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stop: { flexDirection: 'row', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: 'Outfit_600SemiBold' },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
});
