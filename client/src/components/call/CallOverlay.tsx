import { VideoThumbnail } from './VideoThumbnail';
import type { RoomParticipant } from '@stream-party/shared';

interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
}

interface CallOverlayProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStreamInfo>;
  participants: RoomParticipant[];
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
}

export function CallOverlay({
  localStream,
  remoteStreams,
  participants,
  localAudioEnabled,
  localVideoEnabled,
}: CallOverlayProps) {
  // Build list of participants to render
  const participantMap = new Map(participants.map((p) => [p.userId, p]));

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 flex items-end gap-2 overflow-x-auto pb-1 pointer-events-none">
      {/* Remote streams */}
      {Array.from(remoteStreams.entries()).map(([userId, info]) => {
        const participant = participantMap.get(userId);
        return (
          <div key={userId} className="pointer-events-auto">
            <VideoThumbnail
              stream={info.stream}
              displayName={participant?.displayName ?? 'User'}
            />
          </div>
        );
      })}

      {/* Local stream (always last, bottom-right) */}
      {localStream && (
        <div className="pointer-events-auto ml-auto">
          <VideoThumbnail
            stream={localStream}
            displayName="You"
            isLocal
            isMuted={!localAudioEnabled}
          />
        </div>
      )}
    </div>
  );
}
