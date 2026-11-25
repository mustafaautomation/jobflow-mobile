import { useState, type ReactNode } from 'react';
import { Text } from 'react-native';
import { useActor, useRepository, useSubscribed } from '@/features/data-hooks';
import { JobCard } from '@/features/today/TodayView';
import { EmptyState, ErrorState, Kicker, LoadingState, Screen, TextField, Title } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export function ScheduleView({ onOpenJob }: { onOpenJob: (jobId: string) => void }) {
  const actor = useActor();
  const repo = useRepository();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const allowed = actor?.role === 'dispatcher' || actor?.role === 'owner';
  const { state, retry } = useSubscribed(
    () => (allowed && actor && repo ? repo.listSchedule(actor, query) : Promise.resolve([])),
    actor ? `schedule:${actor.organizationId}:${query}` : 'none',
  );

  if (!allowed) {
    return (
      <Screen>
        <EmptyState title="Your route is the schedule" body="Technicians work from Today and Route. Dispatch sees every job here." />
      </Screen>
    );
  }

  const jobs = state.status === 'ready' ? state.data : [];
  const groups = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const key = job.assigneeName ?? 'Unassigned';
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  return (
    <Screen testID="schedule-screen">
      <Kicker>Jobs</Kicker>
      <Title>Everyone’s day.</Title>
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Customer, street, or tech" testID="schedule-search" />
      {state.status === 'loading' ? <LoadingState label="Loading jobs" /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} onRetry={retry} /> : null}
      {state.status === 'ready' && jobs.length === 0 ? (
        <EmptyState title="No jobs match" body="Try a customer name, a street, or clear the search." actionLabel="Clear search" onAction={() => setQuery('')} />
      ) : null}
      {[...groups.entries()].map(([name, items]) => (
        <ViewGroup key={name} name={name} color={colors.ink}>
          {items.map((job) => (
            <JobCard key={job.id} job={job} onPress={() => onOpenJob(job.id)} />
          ))}
        </ViewGroup>
      ))}
    </Screen>
  );
}

function ViewGroup({ name, color, children }: { name: string; color: string; children: ReactNode }) {
  return (
    <>
      <Text style={{ fontFamily: 'Outfit_600SemiBold', color, marginTop: 8 }}>{name}</Text>
      {children}
    </>
  );
}
