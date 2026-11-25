import { Platform } from 'react-native';

export interface PushRegistration {
  permission: string;
  token: string;
  source: 'expo' | 'local';
}

export async function prepareNotifications(): Promise<PushRegistration> {
  if (Platform.OS === 'web') {
    return { permission: 'inbox', token: 'web-inbox', source: 'local' };
  }
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const current = await Notifications.getPermissionsAsync();
    const next = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!next.granted) return { permission: 'denied', token: '', source: 'local' };
    try {
      const token = await Notifications.getExpoPushTokenAsync();
      return { permission: 'granted', token: token.data, source: 'expo' };
    } catch {
      return { permission: 'granted', token: 'ExponentPushToken[local]', source: 'local' };
    }
  } catch {
    return { permission: 'unavailable', token: 'ExponentPushToken[local]', source: 'local' };
  }
}

export async function presentLocalNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // The in-app inbox still records the alert.
  }
}
