import { useState, useEffect, useCallback } from "react";
import * as db from "../lib/db";
import { useAppStore } from "../stores/appStore";
import { seedSystemTemplates } from "../lib/systemTemplates";
import type { Provider } from "../types";

export function useProviderInit() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const setProviderId = useAppStore((s) => s.setProviderId);

  useEffect(() => {
    async function load() {
      try {
        const p = await db.getProvider();
        if (p) {
          setProviderId(p.id);
          setProvider(p);
          setNeedsSetup(false);
          // Seed system templates on first load (no-op if already seeded)
          await seedSystemTemplates();
        } else {
          setNeedsSetup(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load provider");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setProviderId]);

  const createInitialProvider = useCallback(
    async (input: Omit<Provider, "createdAt" | "updatedAt">) => {
      const p = await db.createProvider(input);
      setProviderId(p.id);
      setProvider(p);
      setNeedsSetup(false);
      await seedSystemTemplates();
      return p;
    },
    [setProviderId],
  );

  const refreshProvider = useCallback(async () => {
    const p = await db.getProvider();
    if (p) {
      setProvider(p);
      setProviderId(p.id);
    }
  }, [setProviderId]);

  return { loading, needsSetup, error, provider, createInitialProvider, refreshProvider };
}
