import { useState, useEffect, useCallback } from "react";
import * as db from "../lib/db";
import type { Provider } from "../types";

export function useDatabase() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProvider = useCallback(async () => {
    try {
      setLoading(true);
      const p = await db.getProvider();
      setProvider(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load provider");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  return {
    provider,
    loading,
    error,
    createProvider: db.createProvider,
    createPatient: db.createPatient,
    listPatients: db.listPatients,
    getPatient: db.getPatient,
    updatePatient: db.updatePatient,
    deletePatient: db.deletePatient,
    createTemplate: db.createTemplate,
    listTemplates: db.listTemplates,
    getTemplate: db.getTemplate,
    updateTemplate: db.updateTemplate,
    deleteTemplate: db.deleteTemplate,
    createSession: db.createSession,
    listSessions: db.listSessions,
    getSession: db.getSession,
    updateSession: db.updateSession,
    deleteSession: db.deleteSession,
    refresh: loadProvider,
  };
}
