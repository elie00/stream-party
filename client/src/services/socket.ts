import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@stream-party/shared';
import { useRoomStore } from '../stores/roomStore';
import { useToastStore } from '../components/ui/Toast';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let reconnectListenersAttached = false;

export function getSocket(): TypedSocket {
  if (!socket) {
    const authData = JSON.parse(localStorage.getItem('stream-party-auth') || '{}');
    socket = io('/', {
      auth: { token: authData?.state?.token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // Attach reconnection listeners once per socket instance
    if (!reconnectListenersAttached) {
      attachReconnectListeners(socket);
      reconnectListenersAttached = true;
    }
  }
  return socket;
}

function attachReconnectListeners(s: TypedSocket) {
  s.on('connect', () => {
    // If we were in a room, re-join it
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      const addToast = useToastStore.getState().addToast;
      addToast('Reconnected!', 'success');

      s.emit('room:join', { code: roomStore.room.code }, (res) => {
        if (!res.success) {
          addToast(res.error || 'Failed to rejoin room after reconnect', 'error');
        }
      });
    }
  });

  s.on('disconnect', () => {
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      const addToast = useToastStore.getState().addToast;
      addToast('Connection lost, reconnecting...', 'error');
    }
  });

  s.on('connect_error', () => {
    // Only show once, not on every retry
    const roomStore = useRoomStore.getState();
    if (roomStore.room) {
      // connect_error fires repeatedly; the disconnect toast already covers this
    }
  });
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectListenersAttached = false;
  }
}
