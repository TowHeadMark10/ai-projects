import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

// Configure how notifications behave when the app is in the foreground.
// shouldShowBanner: false → no banner shown (we already have sounds for that).
// The notification will only appear visually when the app is in the background.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    // Ask the user for notification permissions (required on iOS)
    Notifications.requestPermissionsAsync();

    // Register the "mute" action button that appears on the notification
    Notifications.setNotificationCategoryAsync("timer", [
      {
        identifier: "mute",
        buttonTitle: "Mute sounds",
        options: { isDestructive: false },
      },
    ]);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
