import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DMList, DMConversation } from '../components/dm';
import { useDM } from '../hooks/useDM';
import { useAuthStore } from '../stores/authStore';
import { connectSocket } from '../services/socket';

export function DMPage() {
  const navigate = useNavigate();
  const { isAuthenticated, userId, displayName } = useAuthStore();
  const {
    channels,
    activeChannel,
    messages,
    typingUsers,
    unreadCounts,
    loadChannels,
    openChannel,
    sendMessage,
    loadHistory,
    startTyping,
    stopTyping,
    selectChannel,
    setActiveChannel,
  } = useDM();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    connectSocket();
    loadChannels();
  }, []);

  return (
    <div className="h-screen bg-[#111] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#333] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-[#a0a0a0] hover:text-white hover:bg-[#333] transition-colors"
            title="Accueil"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <h1 className="text-white font-semibold">Messages</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#a0a0a0]">{displayName}</span>
          <div className="w-7 h-7 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-xs font-semibold">
            {displayName?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - DM list */}
        <div className={`w-72 border-r border-[#333] flex-shrink-0 ${activeChannel ? 'hidden md:block' : 'block'}`}>
          <DMList
            channels={channels}
            activeChannelId={activeChannel?.id || null}
            unreadCounts={unreadCounts}
            currentUserId={userId}
            onSelectChannel={selectChannel}
            onOpenNewDM={openChannel}
          />
        </div>

        {/* Conversation area */}
        <div className={`flex-1 ${!activeChannel ? 'hidden md:flex' : 'flex'}`}>
          {activeChannel ? (
            <div className="flex-1">
              <DMConversation
                channel={activeChannel}
                messages={messages}
                currentUserId={userId}
                typingUsers={typingUsers}
                onSend={sendMessage}
                onTypingStart={startTyping}
                onTypingStop={stopTyping}
                onLoadMore={loadHistory}
                onBack={() => setActiveChannel(null)}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 text-[#333] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h2 className="text-white font-semibold text-lg mb-1">Vos messages</h2>
                <p className="text-[#606060] text-sm">
                  Sélectionnez une conversation ou démarrez-en une nouvelle
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
