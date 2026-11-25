import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import type { MemberStatus } from '@/domain/types';
import { Card, EmptyState, ErrorState, Kicker, LoadingState, MemberPill, Muted, Screen, Title, UrgentTag } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { JobCard } from '@/features/today/TodayView';

const FILTERS: (MemberStatus | 'all')[] = ['all', 'on_job', 'en_route', 'paused', 'available', 'offline'];

export function BoardView({ onOpenJob }: { onOpenJob: (jobId: string) => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const allowed = actor?.role === 'dispatcher' || actor?.role === 'owner';
  const { state, retry } = useSubscribed(
    () => (allowed && actor && repo ? repo.listDispatchBoard(actor) : Promise.resolve(null)),
    actor ? `board:${actor.organizationId}:${actor.role}` : 'none',
  );

  if (!allowed) {
    return (
      <Screen>
        <EmptyState title="Dispatch lives with the office" body="Technicians see their own route. Switch to a dispatcher seat to run the board." testID="board-forbidden" />
      </Screen>
    );
  }

  const board = state.status === 'ready' ? state.data : null;
  const technicians = board?.technicians.filter((person) => filter === 'all' || person.status === filter) ?? [];

  return (
    <Screen testID="board-screen">
      <Kicker>{actor?.organizationName ?? 'Dispatch'}</Kicker>
      <Title>Who’s on a call.</Title>
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={`Show ${item}`}
            onPress={() => setFilter(item)}
            testID={`filter-${item}`}
            style={[styles.chip, { backgroundColor: filter === item ? colors.primary : colors.bgElevated, borderColor: colors.line }]}
          >
            <Text style={{ color: filter === item ? colors.onPrimary : colors.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 12 }}>
              {item === 'all' ? 'All' : item === 'on_job' ? 'On job' : item === 'en_route' ? 'En route' : item[0]?.toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {state.status === 'loading' ? <LoadingState label="Loading the board" /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} onRetry={retry} /> : null}
      {board && technicians.length === 0 ? <EmptyState title="No technicians in this view" body="Try another status, or add a technician in the office." /> : null}
      {technicians.map((person) => (
        <Card key={person.memberId} testID={`tech-${person.memberId}`}>
          <View style={styles.row}>
            <Text style={[styles.name, { color: colors.ink }]}>{person.fullName}</Text>
            <MemberPill status={person.status} />
          </View>
          <Muted>{person.activeJobTitle ? person.activeJobTitle : 'No active job'}</Muted>
          <Muted>{person.remainingStops} open {person.remainingStops === 1 ? 'stop' : 'stops'}</Muted>
          {person.activeJobId ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${person.activeJobTitle ?? 'job'}`} onPress={() => onOpenJob(person.activeJobId!)}>
              <Text style={{ color: colors.primary, fontFamily: 'Outfit_600SemiBold' }}>Open active job</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
      <Kicker>Unassigned</Kicker>
      {board && board.unassigned.length === 0 ? <Muted>Every open call has a name on it.</Muted> : null}
      {board?.unassigned.map((job) => (
        <View key={job.id} style={styles.unassigned}>
          <UrgentTag priority={job.priority} />
          <JobCard job={job} onPress={() => onOpenJob(job.id)} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: 'Outfit_600SemiBold', fontSize: 18, flex: 1 },
  unassigned: { gap: 8 },
});
