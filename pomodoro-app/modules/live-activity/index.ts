import { NativeModules } from 'react-native';

const { LiveActivityModule } = NativeModules;

export async function startActivity(
  sessionType: string,
  totalSeconds: number,
  endTimestamp: number
): Promise<void> {
  if (!LiveActivityModule) return;
  return LiveActivityModule.startActivity(sessionType, totalSeconds, endTimestamp);
}

export async function updateActivity(
  endTimestamp: number,
  isPaused: boolean,
  timeRemaining: number
): Promise<void> {
  if (!LiveActivityModule) return;
  return LiveActivityModule.updateActivity(endTimestamp, isPaused, timeRemaining);
}

export async function endActivity(timeRemaining: number): Promise<void> {
  if (!LiveActivityModule) return;
  return LiveActivityModule.endActivity(timeRemaining);
}
