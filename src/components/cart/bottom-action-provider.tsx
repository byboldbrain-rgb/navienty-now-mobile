import { useFocusEffect, usePathname } from 'expo-router';
import {
  createContext,
  useRef,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  normalizeBottomActionPath,
  selectActiveBottomAction,
} from './bottom-action-selection';

/**
 * Bottom actions belong to the active screen, not to a collection of
 * independent absolute-positioned overlays. The root host is the only
 * place where a bottom action is physically rendered.
 */
export type BottomActionKind =
  | 'product-purchase'
  | 'cart-summary'
  | 'checkout'
  | 'none';

type BottomActionEntry = {
  id: string;
  pathname: string;
  kind: BottomActionKind;
  priority: number;
  content: ReactNode;
};

type BottomActionControls = {
  register: (entry: BottomActionEntry) => void;
  unregister: (id: string) => void;
};

// Separate the stable command context from the changing registry. Screen
// registrations must never rerender because another screen registers.
const ControlsContext = createContext<BottomActionControls | null>(null);
const EntriesContext = createContext<BottomActionEntry[]>([]);

export function BottomActionProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<BottomActionEntry[]>([]);

  const register = useCallback((entry: BottomActionEntry) => {
    setEntries(current => {
      const index = current.findIndex(item => item.id === entry.id);
      if (index === -1) return [...current, entry];

      const previous = current[index];
      if (
        previous.pathname === entry.pathname &&
        previous.kind === entry.kind &&
        previous.priority === entry.priority &&
        previous.content === entry.content
      ) {
        return current;
      }

      const next = [...current];
      next[index] = entry;
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries(current => current.some(entry => entry.id === id)
      ? current.filter(entry => entry.id !== id)
      : current);
  }, []);

  const controls = useMemo(
    () => ({ register, unregister }),
    [register, unregister],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <EntriesContext.Provider value={entries}>
        {children}
      </EntriesContext.Provider>
    </ControlsContext.Provider>
  );
}

export function useHasBottomActionProvider(): boolean {
  return useContext(ControlsContext) !== null;
}

/**
 * Screen-owned action. Registers without rendering a second dock in the
 * screen tree. The host chooses the most specific active action.
 * A 'none' slot explicitly opts a screen out of the fallback cart dock.
 */
export function BottomActionSlot({
  kind,
  children = null,
  priority = 100,
  enabled = true,
}: {
  kind: BottomActionKind;
  children?: ReactNode;
  priority?: number;
  enabled?: boolean;
}) {
  const context = useContext(ControlsContext);
  const id = useId();
  const pathname = normalizeBottomActionPath(usePathname());
  const isFocusedRef = useRef(false);
  const entryRef = useRef<BottomActionEntry>({
    id,
    pathname,
    kind,
    priority,
    content: children,
  });

  entryRef.current = { id, pathname, kind, priority, content: children };

  // A stacked screen may stay mounted and still observe the globally changing
  // pathname. Focus lifecycle prevents its previous action from re-registering
  // over the current screen during forward/back navigation.
  useFocusEffect(
    useCallback(() => {
      if (!context || !enabled) return undefined;
      isFocusedRef.current = true;
      context.register(entryRef.current);

      return () => {
        isFocusedRef.current = false;
        context.unregister(id);
      };
    }, [context?.register, context?.unregister, enabled, id]),
  );

  // Update the registered content when price, selected quantity or cart
  // changes without registering an unfocused route.
  useLayoutEffect(() => {
    if (context && enabled && isFocusedRef.current) {
      context.register(entryRef.current);
    }
  }, [children, context?.register, enabled, kind, pathname, priority]);

  return null;
}

/**
 * Only host in the app. Registrations from previous navigation screens are
 * ignored immediately, even if React Navigation keeps those screens mounted.
 */
export function BottomActionHost({
  enabled = true,
  fallback = null,
}: {
  enabled?: boolean;
  fallback?: ReactNode;
}) {
  const pathname = normalizePathname(usePathname());
  const entries = useContext(EntriesContext);

  const active = useMemo(
    () => selectActiveBottomAction(entries, pathname),
    [entries, pathname],
  );

  if (!enabled || active?.kind === 'none') return null;

  const content = active ? active.content : fallback;
  if (content == null) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
});
