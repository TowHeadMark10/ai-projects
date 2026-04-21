import * as React from 'react';

import { LiveActivityViewProps } from './LiveActivity.types';

export default function LiveActivityView(props: LiveActivityViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
