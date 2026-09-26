import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";

const rootApi = getRouteApi("__root__");

export const useViewer = () => rootApi.useRouteContext({ select: (context) => context.viewer });

// Runs a mutation, then re-runs active loaders so the page shows persisted state.
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const run = async <T>(mutation: () => Promise<T>) => {
    setPending(true);
    setError(undefined);

    try {
      await mutation();
      await router.invalidate({ sync: true });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));

      return false;
    } finally {
      setPending(false);
    }
  };

  return { pending, error, run };
}
