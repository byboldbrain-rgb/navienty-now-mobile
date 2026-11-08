import { usePathname } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

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

type BottomActionContextValue = {
  entries: BottomActionEntry[];
  register: (entry: BottomActionEntry) => void;
  unregister: (id: string) => void;
};

const BottomActionContext = createContext<BottomActionContextValue | null>(null);

function normalizePathname(pathname: string | null): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

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

  const value = useMemo(
    () => ({ entries, register, unregister }),
    [entries, register, unregister],
  );

  return (
    <BottomActionContext.Provider value={value}>
      {children}
    </BottomActionContext.Provider>
  );
}

export function useHasBottomActionProvider(): boolean {
  return useContext(BottomActionContext) !== null;
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
  const context = useContext(BottomActionContext);
  const id = useId();
  const pathname = normalizePathname(usePathname());

  useLayoutEffect(() => {
    if (!context) return;
    if (!enabled) {
      context.unregister(id);
      return;
    }

    context.register({
      id,
      pathname,
      kind,
      priority,
      content: children,
    });
  }, [children, context?.register, context?.unregister, enabled, id, kind, pathname, priority]);

  useLayoutEffect(() => {
    return () => {
      context?.unregister(id);
    };
  }, [context?.unregister, id]);

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
  const context = useContext(BottomActionContext);

  const active = useMemo(() => {
    const entries = context?.entries ?? [];
    let winner: BottomActionEntry | null = null;
    let winnerIndex = -1;

    entries.forEach((entry, index) => {
      if (entry.pathname !== pathname) return;
      if (
        !winner ||
        entry.priority > winner.priority ||
        (entry.priority === winner.priority && index > winnerIndex)
      ) {
        winner = entry;
        winnerIndex = index;
      }
    });

    return winner;
  }, [context?.entries, pathname]);

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
