import { Redirect, Tabs } from 'expo-router';
import { useAppState } from '@/controller/provider';
import { LoadingState, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';
import { TabIcon } from '@/ui/tab-icon';

export default function AppLayout() {
  const { snapshot } = useAppState();
  const { colors } = useTheme();
  if (!snapshot.ready) {
    return (
      <Screen>
        <LoadingState label="Opening Jobflow" />
      </Screen>
    );
  }
  if (!snapshot.actor) return <Redirect href="/welcome" />;
  const dispatch = snapshot.actor.role !== 'technician';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.line,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: 'Outfit_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          href: dispatch ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="today" color={String(color)} />,
          tabBarButtonTestID: 'tab-today',
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: 'Route',
          href: dispatch ? null : undefined,
          tabBarIcon: ({ color }) => <TabIcon name="route" color={String(color)} />,
          tabBarButtonTestID: 'tab-route',
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          href: dispatch ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="board" color={String(color)} />,
          tabBarButtonTestID: 'tab-board',
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Jobs',
          href: dispatch ? undefined : null,
          tabBarIcon: ({ color }) => <TabIcon name="jobs" color={String(color)} />,
          tabBarButtonTestID: 'tab-jobs',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <TabIcon name="account" color={String(color)} />,
          tabBarButtonTestID: 'tab-account',
        }}
      />
    </Tabs>
  );
}
