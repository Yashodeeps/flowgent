// EX4: ComponentsContext lets <Wizard> pass a merged UIComponentMap down without
// exposing React Context to library users.

import { createContext, useContext } from 'react';
import type { UIComponentMap } from '../types.js';

export const ComponentsContext = createContext<UIComponentMap | null>(null);

export function useComponents(): UIComponentMap {
  const ctx = useContext(ComponentsContext);
  if (!ctx) {
    throw new Error(
      '@flowgent/core: useComponents() called outside <Wizard>. Mount <Wizard config bridge> at the top of your tree.',
    );
  }
  return ctx;
}
