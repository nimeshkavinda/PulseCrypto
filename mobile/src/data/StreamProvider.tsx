import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StreamRuntime } from './StreamRuntime';
import { nativeStreamDeps } from './stream/platform';
import { currentGatewayConfig } from '../config/gateway';
import { defaultStorage } from '../storage/storageRepository';

const StreamRuntimeContext = createContext<StreamRuntime | null>(null);

function createDefaultRuntime(): StreamRuntime {
  return new StreamRuntime({
    storage: defaultStorage,
    deps: nativeStreamDeps,
    resolveUrl: () => currentGatewayConfig().wsUrl,
  });
}

/**
 * Owns the app's single StreamRuntime. The context value never changes, so providing it causes no
 * re-renders; components subscribe to exactly the store slices they need via selector hooks.
 */
export function StreamProvider({ children, runtime }: { children: ReactNode; runtime?: StreamRuntime }) {
  const [rt] = useState(() => runtime ?? createDefaultRuntime());
  useEffect(() => {
    rt.start();
    return () => rt.stop();
  }, [rt]);
  return <StreamRuntimeContext.Provider value={rt}>{children}</StreamRuntimeContext.Provider>;
}

export function useStreamRuntime(): StreamRuntime {
  const rt = useContext(StreamRuntimeContext);
  if (!rt) throw new Error('useStreamRuntime must be used within <StreamProvider>');
  return rt;
}
