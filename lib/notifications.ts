import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase, SUPABASE_READY } from './supabase';

// Show alerts + play sound when notification arrives in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

const PROJECT_ID = '28ea623e-21f9-4f20-b20e-e19280d8df6e';

export async function registerPushToken(userId: string): Promise<void> {
  if (!SUPABASE_READY) return;

  // Push notifications only work on physical devices, not simulators
  const isDevice = Constants.isDevice;
  if (!isDevice) return;

  // Web push is not handled via Expo
  if (Platform.OS === 'web') return;

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C9A84C',
    });
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  const token = tokenData.data;
  if (!token) return;

  // Persist to profile so server can look it up
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

export function addNotificationListener(
  onNotification: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(onNotification);
}

export function addNotificationResponseListener(
  onResponse: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(onResponse);
}
