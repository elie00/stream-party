import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockReturning = vi.fn();
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockReturnThis();

vi.mock('../../db/index', () => ({
    db: {
        query: {
            messages: {
                findFirst: (...args: any[]) => mockFindFirst(...args),
                findMany: (...args: any[]) => mockFindMany(...args),
            },
            messageThreads: {
                findFirst: (...args: any[]) => mockFindFirst(...args),
            },
            users: {
                findFirst: (...args: any[]) => mockFindFirst(...args),
            },
        },
        update: (...args: any[]) => {
            mockUpdate(...args);
            return {
                set: (...setArgs: any[]) => {
                    mockSet(...setArgs);
                    return {
                        where: (...whereArgs: any[]) => {
                            mockWhere(...whereArgs);
                            return {
                                returning: () => mockReturning(),
                            };
                        },
                    };
                },
            };
        },
        insert: (...args: any[]) => {
            mockInsert(...args);
            return {
                values: (...valArgs: any[]) => {
                    mockValues(...valArgs);
                    return {
                        returning: () => mockReturning(),
                    };
                },
            };
        },
    },
    schema: {
        messages: { id: 'id', userId: 'userId', content: 'content', isDeleted: 'isDeleted', threadId: 'threadId', createdAt: 'createdAt' },
        messageThreads: { id: 'id', parentMessageId: 'parentMessageId', replyCount: 'replyCount' },
        users: { id: 'id' },
    },
}));

// Mock shared module
vi.mock('@stream-party/shared', () => ({
    MAX_CHAT_MESSAGE_LENGTH: 500,
}));

import { editMessage, deleteMessage, getReplyCount } from '../chatService';

describe('chatService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('editMessage', () => {
        it('should reject empty content', async () => {
            const result = await editMessage('msg-1', 'user-1', '');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message content cannot be empty');
        });

        it('should reject whitespace-only content', async () => {
            const result = await editMessage('msg-1', 'user-1', '   ');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message content cannot be empty');
        });

        it('should reject content exceeding max length', async () => {
            const longContent = 'a'.repeat(501);
            const result = await editMessage('msg-1', 'user-1', longContent);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message content is too long');
        });

        it('should reject if message is not found', async () => {
            mockFindFirst.mockResolvedValueOnce(null);
            const result = await editMessage('msg-1', 'user-1', 'hello');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message not found');
        });

        it('should reject if user is not the author', async () => {
            mockFindFirst.mockResolvedValueOnce({
                id: 'msg-1',
                userId: 'user-2',
                isDeleted: false,
            });
            const result = await editMessage('msg-1', 'user-1', 'hello');
            expect(result.success).toBe(false);
            expect(result.error).toBe('You can only edit your own messages');
        });

        it('should reject editing a deleted message', async () => {
            mockFindFirst.mockResolvedValueOnce({
                id: 'msg-1',
                userId: 'user-1',
                isDeleted: true,
            });
            const result = await editMessage('msg-1', 'user-1', 'hello');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot edit a deleted message');
        });

        it('should successfully edit a valid message', async () => {
            mockFindFirst
                .mockResolvedValueOnce({
                    id: 'msg-1',
                    userId: 'user-1',
                    isDeleted: false,
                });

            const updatedMsg = {
                id: 'msg-1',
                roomId: 'room-1',
                userId: 'user-1',
                content: 'updated content',
                createdAt: new Date(),
                editedAt: new Date(),
                isDeleted: false,
                parentId: null,
                threadId: null,
            };
            mockReturning.mockResolvedValueOnce([updatedMsg]);

            // Mock user lookup
            mockFindFirst.mockResolvedValueOnce({
                id: 'user-1',
                displayName: 'TestUser',
            });

            const result = await editMessage('msg-1', 'user-1', 'updated content');
            expect(result.success).toBe(true);
            expect(result.message?.content).toBe('updated content');
            expect(result.message?.user.displayName).toBe('TestUser');
        });
    });

    describe('deleteMessage', () => {
        it('should reject if message is not found', async () => {
            mockFindFirst.mockResolvedValueOnce(null);
            const result = await deleteMessage('msg-1', 'user-1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message not found');
        });

        it('should reject if user is not the author', async () => {
            mockFindFirst.mockResolvedValueOnce({
                id: 'msg-1',
                userId: 'user-2',
                isDeleted: false,
            });
            const result = await deleteMessage('msg-1', 'user-1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('You can only delete your own messages');
        });

        it('should reject if already deleted', async () => {
            mockFindFirst.mockResolvedValueOnce({
                id: 'msg-1',
                userId: 'user-1',
                isDeleted: true,
            });
            const result = await deleteMessage('msg-1', 'user-1');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Message is already deleted');
        });

        it('should soft delete a valid message', async () => {
            mockFindFirst.mockResolvedValueOnce({
                id: 'msg-1',
                userId: 'user-1',
                isDeleted: false,
            });
            const result = await deleteMessage('msg-1', 'user-1');
            expect(result.success).toBe(true);
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe('getReplyCount', () => {
        it('should return 0 when no thread exists', async () => {
            mockFindFirst.mockResolvedValueOnce(null);
            const count = await getReplyCount('msg-1');
            expect(count).toBe(0);
        });

        it('should return the thread reply count', async () => {
            mockFindFirst.mockResolvedValueOnce({ replyCount: 5 });
            const count = await getReplyCount('msg-1');
            expect(count).toBe(5);
        });
    });
});
