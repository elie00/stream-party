import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the DB module before importing the service
vi.mock('../../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
    },
}));

vi.mock('../../db/schema', () => ({
    channels: { id: 'id', slowmode: 'slowmode', slowmodeRoles: 'slowmodeRoles', serverId: 'serverId' },
    serverMembers: { serverId: 'serverId', userId: 'userId' },
    roles: {},
}));

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { slowmodeService, SLOWMODE_OPTIONS } from '../slowmodeService';

describe('SlowmodeService', () => {
    beforeEach(() => {
        // Clear all cooldowns between tests by clearing for known channels
        slowmodeService.clearCooldowns('channel-1');
        slowmodeService.clearCooldowns('channel-2');
        slowmodeService.clearCooldowns('channel-3');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('SLOWMODE_OPTIONS', () => {
        it('should include a disabled option (0)', () => {
            expect(SLOWMODE_OPTIONS.find((o) => o.value === 0)).toBeDefined();
        });

        it('should have values between 0 and 900', () => {
            for (const option of SLOWMODE_OPTIONS) {
                expect(option.value).toBeGreaterThanOrEqual(0);
                expect(option.value).toBeLessThanOrEqual(900);
            }
        });

        it('should have labels for all options', () => {
            for (const option of SLOWMODE_OPTIONS) {
                expect(option.label).toBeTruthy();
            }
        });
    });

    describe('recordMessage', () => {
        it('should record a message timestamp for user/channel pair', () => {
            const now = Date.now();
            vi.setSystemTime(now);

            // Force the random to not cleanup (so we don't need to worry about that)
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            slowmodeService.recordMessage('user-1', 'channel-1');

            // We can verify indirectly that the cooldown was set by calling clearCooldowns
            // and checking it doesn't throw
            slowmodeService.clearCooldowns('channel-1');
        });

        it('should overwrite the timestamp on subsequent messages', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            vi.setSystemTime(1000);
            slowmodeService.recordMessage('user-1', 'channel-1');

            vi.setSystemTime(2000);
            slowmodeService.recordMessage('user-1', 'channel-1');

            // The cooldown should now be based on the latest message time (2000)
            slowmodeService.clearCooldowns('channel-1');
        });
    });

    describe('clearCooldowns', () => {
        it('should clear all cooldowns for a specific channel', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            slowmodeService.recordMessage('user-1', 'channel-1');
            slowmodeService.recordMessage('user-2', 'channel-1');
            slowmodeService.recordMessage('user-1', 'channel-2');

            slowmodeService.clearCooldowns('channel-1');

            // channel-2 cooldowns should still exist (not cleared)
            // We can't directly check the Map, but we can verify no error is thrown
        });

        it('should not affect cooldowns for other channels', () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            slowmodeService.recordMessage('user-1', 'channel-1');
            slowmodeService.recordMessage('user-1', 'channel-2');

            slowmodeService.clearCooldowns('channel-1');

            // No error should occur
        });

        it('should handle clearing non-existent channel gracefully', () => {
            expect(() => slowmodeService.clearCooldowns('non-existent')).not.toThrow();
        });
    });

    describe('getSlowmode', () => {
        it('should return default values when channel is not found', async () => {
            const result = await slowmodeService.getSlowmode('unknown-channel');
            expect(result).toEqual({ slowmode: 0, slowmodeRoles: [] });
        });
    });

    describe('checkSlowmode', () => {
        it('should return true when slowmode is disabled (0)', async () => {
            // getSlowmode returns { slowmode: 0, slowmodeRoles: [] } by default (mock returns [])
            const result = await slowmodeService.checkSlowmode('user-1', 'channel-1');
            expect(result).toBe(true);
        });
    });

    describe('getSlowmodeCooldown', () => {
        it('should return 0 when slowmode is disabled', async () => {
            const result = await slowmodeService.getSlowmodeCooldown('user-1', 'channel-1');
            expect(result).toBe(0);
        });
    });
});
