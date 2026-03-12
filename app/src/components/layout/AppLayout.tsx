import Sidebar from "./Sidebar";
import MainContent from "./MainContent";
import CreateSessionModal from "../sessions/CreateSessionModal";
import { SidecarProvider } from "../../contexts/SidecarContext";

interface AppLayoutProps {
  providerName: string;
  providerEmail: string;
}

export default function AppLayout({
  providerName,
  providerEmail,
}: AppLayoutProps) {
  return (
    <SidecarProvider>
      <div className="flex h-screen">
        <Sidebar providerName={providerName} providerEmail={providerEmail} />
        <MainContent />
        <CreateSessionModal />
      </div>
    </SidecarProvider>
  );
}
