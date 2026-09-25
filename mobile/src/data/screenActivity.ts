import { createContext, useContext } from 'react';

/**
 * Whether the enclosing screen is visible. Tabs stay mounted; a hidden screen reads its market data
 * paused (no re-renders on updates) and catches up with the latest values as soon as it is shown.
 * Components outside any screen are always active.
 */
const ScreenActiveContext = createContext(true);

export const ScreenActivity = ScreenActiveContext.Provider;
export const useScreenActive = () => useContext(ScreenActiveContext);
