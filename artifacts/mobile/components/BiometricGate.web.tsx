import React from 'react';

interface Props {
  children: React.ReactNode;
  enabled: boolean;
}

export function BiometricGate({ children }: Props) {
  return <>{children}</>;
}
