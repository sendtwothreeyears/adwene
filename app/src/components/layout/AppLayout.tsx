import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import CreateSessionModal from "../sessions/CreateSessionModal";

interface AppLayoutProps {
  providerName: string;
  providerEmail: string;
}

export default function AppLayout({
  providerName,
  providerEmail,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar providerName={providerName} providerEmail={providerEmail} />
      <MainContent />
      <CreateSessionModal />
    </div>
  );
}
