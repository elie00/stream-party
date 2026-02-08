import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from '../syncEngine';
import type { SyncState } from '@stream-party/shared';

// Mock socket
vi.mock('../socket', () => ({
    getSocket: () => ({
        emit: vi.fn(),
    }),
}));

// Create a mock Video.js player
function createMockPlayer(initialState: { currentTime: number; paused: boolean; playbackRate: number }) {
    return {
        currentTime: vi.fn((time?: number) => {
            if (time !== undefined) {
                initialState.currentTime = time;
            }
            return initialState.currentTime;
        }),
        paused: vi.fn(() => initialState.paused),
        playbackRate: vi.fn((rate?: number) => {
            if (rate !== undefined) {
                initialState.playbackRate = rate;
            }
            return initialState.playbackRate;
        }),
        play: vi.fn(() => {
            initialState.paused = false;
        }),
        pause: vi.fn(() => {
            initialState.paused = true;
        }),
    };
}

describe('SyncEngine', () => {
    let syncEngine: SyncEngine;
    let mockPlayer: ReturnType<typeof createMockPlayer>;
    let playerState: { currentTime: number; paused: boolean; playbackRate: number };

    beforeEach(() => {
        syncEngine = new SyncEngine();
        playerState = { currentTime: 10, paused: false, playbackRate: 1 };
        mockPlayer = createMockPlayer(playerState);
        syncEngine.setPlayer(mockPlayer as any);
        vi.useFakeTimers();
    });

    afterEach(() => {
        syncEngine.destroy();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe('handleSyncState - drift correction', () => {
        it('should do nothing when drift < 100ms', () => {
            syncEngine.setHost(false);

            const state: SyncState = {
                currentTime: 10.05, // 50ms difference
                isPlaying: true,
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should not change playback rate
            expect(mockPlayer.playbackRate).not.toHaveBeenCalledWith(expect.any(Number));
            // Should not seek
            expect(mockPlayer.currentTime).not.toHaveBeenCalledWith(expect.any(Number));
        });

        it('should adjust playback rate when drift is 100-500ms (behind host)', () => {
            syncEngine.setHost(false);

            const state: SyncState = {
                currentTime: 10.3, // 300ms ahead - peer is behind
                isPlaying: true,
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should speed up to catch up
            expect(mockPlayer.playbackRate).toHaveBeenCalledWith(1.05);
        });

        it('should adjust playback rate when drift is 100-500ms (ahead of host)', () => {
            syncEngine.setHost(false);
            playerState.currentTime = 10.3; // Peer is ahead

            const state: SyncState = {
                currentTime: 10, // Host is at 10
                isPlaying: true,
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should slow down
            expect(mockPlayer.playbackRate).toHaveBeenCalledWith(0.95);
        });

        it('should force seek when drift > 500ms', () => {
            syncEngine.setHost(false);

            const state: SyncState = {
                currentTime: 15, // 5 seconds difference
                isPlaying: true,
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should force seek to host position
            expect(mockPlayer.currentTime).toHaveBeenCalledWith(15);
        });

        it('should match play/pause state after force seek', () => {
            syncEngine.setHost(false);
            playerState.paused = true; // Peer is paused

            const state: SyncState = {
                currentTime: 20,
                isPlaying: true, // Host is playing
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should start playing to match host
            expect(mockPlayer.play).toHaveBeenCalled();
        });

        it('should pause when host pauses after force seek', () => {
            syncEngine.setHost(false);
            playerState.paused = false; // Peer is playing

            const state: SyncState = {
                currentTime: 20,
                isPlaying: false, // Host is paused
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Should pause to match host
            expect(mockPlayer.pause).toHaveBeenCalled();
        });
    });

    describe('handleSyncState - host behavior', () => {
        it('should ignore sync state when this instance is host', () => {
            syncEngine.setHost(true);

            const state: SyncState = {
                currentTime: 100,
                isPlaying: true,
                playbackRate: 1,
                timestamp: Date.now(),
                magnetUri: null,
                selectedFileIndex: null,
            };

            syncEngine.handleSyncState(state);

            // Host should not react to incoming sync states
            expect(mockPlayer.currentTime).not.toHaveBeenCalledWith(100);
        });
    });

    describe('discrete event handlers', () => {
        it('handlePlay should seek and play for peers', () => {
            syncEngine.setHost(false);

            syncEngine.handlePlay(25);

            expect(mockPlayer.currentTime).toHaveBeenCalledWith(25);
            expect(mockPlayer.play).toHaveBeenCalled();
        });

        it('handlePlay should do nothing for host', () => {
            syncEngine.setHost(true);

            syncEngine.handlePlay(25);

            expect(mockPlayer.currentTime).not.toHaveBeenCalledWith(25);
            expect(mockPlayer.play).not.toHaveBeenCalled();
        });

        it('handlePause should seek and pause for peers', () => {
            syncEngine.setHost(false);

            syncEngine.handlePause(30);

            expect(mockPlayer.currentTime).toHaveBeenCalledWith(30);
            expect(mockPlayer.pause).toHaveBeenCalled();
        });

        it('handleSeek should update time for peers', () => {
            syncEngine.setHost(false);

            syncEngine.handleSeek(45);

            expect(mockPlayer.currentTime).toHaveBeenCalledWith(45);
        });
    });

    describe('isIgnoringEvents', () => {
        it('should return true during seek operations', () => {
            syncEngine.setHost(false);

            expect(syncEngine.isIgnoringEvents()).toBe(false);

            syncEngine.handleSeek(50);

            expect(syncEngine.isIgnoringEvents()).toBe(true);

            // After timeout, should be false again
            vi.advanceTimersByTime(500);
            expect(syncEngine.isIgnoringEvents()).toBe(false);
        });
    });
});
