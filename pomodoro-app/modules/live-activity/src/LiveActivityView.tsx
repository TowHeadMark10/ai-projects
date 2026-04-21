import { requireNativeView } from 'expo';
import * as React from 'react';

import { LiveActivityViewProps } from './LiveActivity.types';

const NativeView: React.ComponentType<LiveActivityViewProps> =
  requireNativeView('LiveActivity');

export default function LiveActivityView(props: LiveActivityViewProps) {
  return <NativeView {...props} />;
}
