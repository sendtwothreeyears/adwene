import { useEffect } from "react";
import { useProviderInit } from "./hooks/useProviderInit";
import { useAppStore } from "./stores/appStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import AppLayout from "./components/layout/AppLayout";
import ProviderSetup from "./components/providers/ProviderSetup";
import PasswordSetup from "./components/providers/PasswordSetup";
import LoginScreen from "./components/providers/LoginScreen";
import { updateProvider } from "./lib/db";

function App() {
  const { loading, needsSetup, error, provider, createInitialProvider, refreshProvider } =
    useProviderInit();
  const authenticated = useAppStore((s) => s.authenticated);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setProviderPhotoUrl = useAppStore((s) => s.setProviderPhotoUrl);
  const setProviderName = useAppStore((s) => s.setProviderName);
  const setProviderEmail = useAppStore((s) => s.setProviderEmail);

  // Sync provider display info to store whenever provider changes
  useEffect(() => {
    setProviderPhotoUrl(
      provider?.profilePhoto ? convertFileSrc(provider.profilePhoto) : null
    );
    const name = [provider?.firstName, provider?.lastName].filter(Boolean).join(" ") || null;
    setProviderName(name);
    setProviderEmail(provider?.email ?? null);
  }, [provider?.firstName, provider?.lastName, provider?.email, provider?.profilePhoto, setProviderPhotoUrl, setProviderName, setProviderEmail]);

  // Gate 0: Loading
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  // Gate 1: Error
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Gate 2: Onboarding — no provider exists
  if (needsSetup) {
    return (
      <ProviderSetup
        onSubmit={async (data) => {
          await createInitialProvider({
            id: crypto.randomUUID(),
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            providerType: data.providerType,
            title: null,
            bio: null,
            profilePhoto: null,
            city: null,
            state: null,
            country: data.country,
            zipCode: null,
            phone: data.phone,
            faxNumber: null,
            officeAddress: null,
            specialty: data.specialty,
            organizationName: data.organizationName,
            practiceName: data.practiceName,
            npi: null,
            licenseNumber: null,
            licenseState: null,
            deaNumber: null,
            taxId: null,
            languages: null,
            yearsOfExperience: null,
            boardCertifications: null,
            passwordHash: null,
            teamSize: data.teamSize,
            orgRole: data.orgRole,
            defaultTemplateId: null,
            signature: null,
          });
        }}
      />
    );
  }

  // Gate 3: Password setup — provider exists but no password set
  if (provider && !provider.passwordHash) {
    return (
      <PasswordSetup
        onComplete={async (passwordHash) => {
          await updateProvider(provider.id, { passwordHash });
          await refreshProvider();
        }}
      />
    );
  }

  // Gate 4: Login — provider has password but not yet authenticated this session
  if (provider && !authenticated) {
    const providerName = [provider.firstName, provider.lastName]
      .filter(Boolean)
      .join(" ") || "Provider";

    const initials = [provider.firstName?.[0], provider.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

    return (
      <LoginScreen
        providerName={providerName}
        providerInitials={initials}
        passwordHash={provider.passwordHash!}
        onLogin={() => setAuthenticated(true)}
      />
    );
  }

  // Gate 5: Authenticated — show the app
  return <AppLayout />;
}

export default App;
