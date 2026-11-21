import { useFocusEffect } from "expo-router";
import * as React from "react";

/**
 * Minimal data loader for screens: loads on focus (so data is fresh after
 * navigating back), exposes refresh for pull-to-refresh, and keeps the last
 * good data while reloading.
 */
export function useQuery<T>(load: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = React.useCallback(load, deps);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar los datos.");
    } finally {
      setRefreshing(false);
    }
  }, [run]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { data, error, refreshing, refresh };
}
