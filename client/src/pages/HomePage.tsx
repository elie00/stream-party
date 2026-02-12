import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Telescope } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { loginAsGuest, createRoom } from '../services/api';
import { useToastStore } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function HomePage() {
  const navigate = useNavigate();
  const { displayName: savedDisplayName, setAuth, isAuthenticated } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);

  const [displayName, setDisplayName] = useState(savedDisplayName || '');
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const ensureAuth = async () => {
    if (!displayName.trim()) {
      addToast('Please enter a display name', 'error');
      return false;
    }

    if (!isAuthenticated()) {
      try {
        const { token, user } = await loginAsGuest(displayName.trim());
        setAuth(token, user.id, user.displayName);
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'Authentication failed', 'error');
        return false;
      }
    }

    return true;
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    if (!roomName.trim()) {
      addToast('Please enter a room name', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const authSuccess = await ensureAuth();
      if (!authSuccess) return;

      const room = await createRoom(roomName.trim());
      addToast('Room created successfully', 'success');
      navigate(`/room/${room.code}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to create room', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoining) return;

    if (!roomCode.trim() || roomCode.length !== 6) {
      addToast('Please enter a 6-character room code', 'error');
      return;
    }

    setIsJoining(true);
    try {
      const authSuccess = await ensureAuth();
      if (!authSuccess) return;

      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to join room', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">StreamParty</h1>
          <p className="text-[#a0a0a0] text-sm mb-6">Watch together in sync</p>

          <Button
            onClick={() => navigate('/discover')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Telescope className="w-4 h-4 mr-2" />
            Discover Content
          </Button>
        </div>

        {/* Display Name Input */}
        <div className="mb-6">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            placeholder="Enter your name"
          />
        </div>

        {/* Create Room Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Create a Room</h2>
          <form onSubmit={handleCreateRoom} className="space-y-3">
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
              placeholder="Room name"
            />
            <Button
              type="submit"
              loading={isCreating}
              className="w-full"
            >
              Create Room
            </Button>
          </form>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#333]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#1a1a1a] text-[#a0a0a0]">or</span>
          </div>
        </div>

        {/* Join Room Section */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Join a Room</h2>
          <form onSubmit={handleJoinRoom} className="space-y-3">
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ROOM CODE"
              className="uppercase font-mono text-center tracking-wider"
            />
            <Button
              type="submit"
              loading={isJoining}
              className="w-full"
            >
              Join Room
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
