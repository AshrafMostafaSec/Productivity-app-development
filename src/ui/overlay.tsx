import { createContext, useContext, useState, type ReactNode } from 'react';

const OverlayContext = createContext<HTMLElement | null>(null);

/** Provides a portal target inside the phone viewport so sheets stay within the device frame. */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <OverlayContext.Provider value={host}>
      {children}
      <div ref={setHost} className="pointer-events-none absolute inset-0 z-40 [&>*]:pointer-events-auto" />
    </OverlayContext.Provider>
  );
}

export function useOverlayHost(): HTMLElement | null {
  return useContext(OverlayContext);
}
