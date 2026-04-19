export type PermissionState = 'unknown' | 'granted' | 'denied';

export type PermissionStatus = {
  accessibility: PermissionState;
  screenRecording: PermissionState;
};

function isPermissionState(value: unknown): value is PermissionState {
  return value === 'unknown' || value === 'granted' || value === 'denied';
}

export function isPermissionStatus(value: unknown): value is PermissionStatus {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const maybeStatus = value as Record<string, unknown>;
  return (
    isPermissionState(maybeStatus.accessibility) && isPermissionState(maybeStatus.screenRecording)
  );
}
