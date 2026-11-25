import { StyleSheet, Text, View } from 'react-native';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import { formatDay, formatTime, greeting } from '@/domain/format';
import type { JobSummary } from '@/domain/types';
import { Card, EmptyState, ErrorState, Kicker, LoadingState, Muted, Screen, StatusPill, Title, UrgentTag } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function TodayView({ onOpenJob }: { onOpenJob: (jobId: string) => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { state, retry } = useSubscribed(
    () => (actor && repo ? repo.listTodayJobs(actor) : Promise.resolve([])),
    actor ? `${actor.userId}:${actor.organizationId}` : 'none',
  );
  const dispatch = actor?.role === 'dispatcher' || actor?.role === 'owner';

  return (
    <Screen testID="today-screen">
      <Kicker>{formatDay(new Date().toISOString())}</Kicker>
      <Title>{actor ? `${greeting(new Date())}, ${actor.fullName.split(' ')[0]}` : 'Today'}</Title>
      <Muted>{actor ? `${actor.organizationName} · ${actor.role}` : 'Loading your seat'}</Muted>
      {dispatch ? (
        <EmptyState
          title="You’re running dispatch"
          body="The board shows who is on a roof and which calls are still unassigned."
          testID="today-dispatch-hint"
        />
      ) : null}
      {state.status === 'loading' ? <LoadingState label="Loading today’s route" /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} onRetry={retry} /> : null}
      {state.status === 'ready' && !dispatch && state.data.length === 0 ? (
        <EmptyState
          title="No stops today"
          body="Dispatch will send the next callout. Pull this screen again after they do."
          actionLabel="Check again"
          onAction={retry}
        />
      ) : null}
      {state.status === 'ready' && !dispatch
        ? state.data.map((job) => <JobCard key={job.id} job={job} onPress={() => onOpenJob(job.id)} />)
        : null}
      {state.status === 'ready' && !dispatch && state.data.length > 0 ? (
        <Muted>
          {state.data.filter((job) => job.status === 'completed').length} of {state.data.length} closed
        </Muted>
      ) : null}
    </Screen>
  );
}

export function JobCard({ job, onPress }: { job: JobSummary; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} testID={`job-card-${job.id}`} label={`${job.customerName}, ${job.title}`}>
      <View style={styles.top}>
        <Text style={[styles.time, { color: colors.ink }]}>{formatTime(job.scheduledStart)}</Text>
        <View style={styles.pills}>
          <UrgentTag priority={job.priority} />
          <StatusPill status={job.status} />
        </View>
      </View>
      <Text style={[styles.customer, { color: colors.ink }]}>{job.customerName}</Text>
      <Muted>{job.title}</Muted>
      <Muted>{job.addressLine}</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pills: { flexDirection: 'row', gap: 6 },
  time: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  customer: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22 },
});
