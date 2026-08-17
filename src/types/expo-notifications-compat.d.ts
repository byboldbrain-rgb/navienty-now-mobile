import 'expo-notifications';

declare module 'expo-notifications' {
  /**
   * Expo SDK 55 has a published typing regression where the generic
   * PermissionResponse fields are missing from NotificationPermissionsStatus,
   * even though getPermissionsAsync/requestPermissionsAsync still return them
   * at runtime. Keep the application code aligned with the runtime contract
   * until the upstream declaration is fixed.
   */
  interface NotificationPermissionsStatus {
    status: PermissionStatus;
    canAskAgain: boolean;
  }
}
