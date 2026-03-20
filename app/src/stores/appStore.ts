import { create } from "zustand";
import type { Patient, Session } from "../types";

export type AppView =
  | "records"
  | "session"
  | "templates"
  | "settings";

interface AppState {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Scribe panel
  scribePanelOpen: boolean;
  toggleScribePanel: () => void;
  setScribePanelOpen: (open: boolean) => void;

  // Sidebar collapse
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Provider (loaded once at startup)
  providerId: string | null;
  setProviderId: (id: string) => void;

  // Patient selection
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;

  // Active session
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;
  /** Merge partial fields into activeSession only if sessionId matches (prevents cross-session contamination). */
  mergeActiveSession: (sessionId: string, fields: Partial<Session>) => void;

  // Session creation loading state
  creatingSession: boolean;
  setCreatingSession: (value: boolean) => void;

  // Auth
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  logout: () => void;

  // Provider display info (synced from settings)
  providerName: string | null;
  providerEmail: string | null;
  setProviderName: (name: string | null) => void;
  setProviderEmail: (email: string | null) => void;
  providerPhotoUrl: string | null;
  setProviderPhotoUrl: (url: string | null) => void;

  // Modal visibility
  showPatientForm: boolean;
  openPatientForm: () => void;
  closePatientForm: () => void;

  showSessionForm: boolean;
  openSessionForm: () => void;
  closeSessionForm: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "session",
  setView: (view) => set({ currentView: view }),

  scribePanelOpen: false,
  toggleScribePanel: () => set((state) => ({ scribePanelOpen: !state.scribePanelOpen })),
  setScribePanelOpen: (open) => set({ scribePanelOpen: open }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  providerId: null,
  setProviderId: (id) => set({ providerId: id }),

  selectedPatient: null,
  setSelectedPatient: (patient) => set({ selectedPatient: patient }),

  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  creatingSession: false,
  setCreatingSession: (value) => set({ creatingSession: value }),
  mergeActiveSession: (sessionId, fields) =>
    set((state) => ({
      activeSession:
        state.activeSession && state.activeSession.id === sessionId
          ? { ...state.activeSession, ...fields }
          : state.activeSession,
    })),

  authenticated: false,
  setAuthenticated: (value) => set({ authenticated: value }),
  logout: () =>
    set({
      authenticated: false,
      activeSession: null,
      currentView: "session",
      scribePanelOpen: false,
    }),

  providerName: null,
  providerEmail: null,
  setProviderName: (name) => set({ providerName: name }),
  setProviderEmail: (email) => set({ providerEmail: email }),
  providerPhotoUrl: null,
  setProviderPhotoUrl: (url) => set({ providerPhotoUrl: url }),

  showPatientForm: false,
  openPatientForm: () => set({ showPatientForm: true }),
  closePatientForm: () => set({ showPatientForm: false }),

  showSessionForm: false,
  openSessionForm: () => set({ showSessionForm: true }),
  closeSessionForm: () => set({ showSessionForm: false }),
}));
