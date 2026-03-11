import { create } from "zustand";
import type { Patient, Session } from "../types";

export type AppView =
  | "records"
  | "current-session"
  | "templates"
  | "recent-sessions";

interface AppState {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Provider (loaded once at startup)
  providerId: string | null;
  setProviderId: (id: string) => void;

  // Patient selection
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;

  // Active session
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;

  // Modal visibility
  showPatientForm: boolean;
  openPatientForm: () => void;
  closePatientForm: () => void;

  showSessionForm: boolean;
  openSessionForm: () => void;
  closeSessionForm: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "records",
  setView: (view) => set({ currentView: view }),

  providerId: null,
  setProviderId: (id) => set({ providerId: id }),

  selectedPatient: null,
  setSelectedPatient: (patient) => set({ selectedPatient: patient }),

  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),

  showPatientForm: false,
  openPatientForm: () => set({ showPatientForm: true }),
  closePatientForm: () => set({ showPatientForm: false }),

  showSessionForm: false,
  openSessionForm: () => set({ showSessionForm: true }),
  closeSessionForm: () => set({ showSessionForm: false }),
}));
