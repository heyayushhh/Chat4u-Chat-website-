import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import IncomingCallModal from "../components/IncomingCallModal";
import CallOverlay from "../components/CallOverlay";
import GroupIncomingCallModal from "../components/GroupIncomingCallModal";
import GroupCallOverlay from "../components/GroupCallOverlay";
import { useEffect } from "react";
import ActiveCallBanner from "../components/ActiveCallBanner";
import WelcomeBanner from "../components/WelcomeBanner";

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const { selectedGroup } = useGroupStore();

  // Group call listeners are initialized after socket connect in auth store

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)]">
          {/* One-time welcome message for new users */}
          <WelcomeBanner />
          {/* Global banner to surface active calls for rejoin */}
          <ActiveCallBanner />
          <div className="flex h-full rounded-lg overflow-hidden">
            <Sidebar />

            {!selectedUser && !selectedGroup && <NoChatSelected />}
            {selectedUser && <ChatContainer />}
            {!selectedUser && selectedGroup && <GroupChatContainer />}
          </div>
          {/* Global Call UI */}
          <IncomingCallModal />
          <CallOverlay />
          <GroupIncomingCallModal />
          <GroupCallOverlay />
        </div>
      </div>
    </div>
  );
};
export default HomePage;
