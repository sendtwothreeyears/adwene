import { useProviderInit } from "./hooks/useProviderInit";
import AppLayout from "./components/layout/AppLayout";
import ProviderSetup from "./components/providers/ProviderSetup";

function App() {
  const { loading, needsSetup, error, provider, createInitialProvider } =
    useProviderInit();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <ProviderSetup
        onSubmit={async ({ firstName, lastName, email, providerType }) => {
          await createInitialProvider({
            id: crypto.randomUUID(),
            email,
            firstName,
            lastName,
            providerType,
            title: null,
            bio: null,
            profilePhoto: null,
            city: null,
            state: null,
            country: null,
            zipCode: null,
            phone: null,
            faxNumber: null,
            officeAddress: null,
            specialty: null,
            organizationName: null,
            practiceName: null,
            npi: null,
            licenseNumber: null,
            licenseState: null,
            deaNumber: null,
            taxId: null,
            languages: null,
            yearsOfExperience: null,
            boardCertifications: null,
          });
        }}
      />
    );
  }

  const providerName = [provider?.firstName, provider?.lastName]
    .filter(Boolean)
    .join(" ") || "Provider";

  return (
    <AppLayout
      providerName={providerName}
      providerEmail={provider?.email ?? ""}
    />
  );
}

export default App;
