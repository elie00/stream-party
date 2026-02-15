import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAuthStore.setState({
            token: null,
            userId: null,
            displayName: null,
        });
    });

    describe('initial state', () => {
        it('should have null values by default', () => {
            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.userId).toBeNull();
            expect(state.displayName).toBeNull();
        });

        it('should not be authenticated initially', () => {
            const state = useAuthStore.getState();
            expect(state.isAuthenticated()).toBe(false);
        });
    });

    describe('setAuth', () => {
        it('should set token, userId, and displayName', () => {
            useAuthStore.getState().setAuth('test-token', 'user-123', 'TestUser');

            const state = useAuthStore.getState();
            expect(state.token).toBe('test-token');
            expect(state.userId).toBe('user-123');
            expect(state.displayName).toBe('TestUser');
        });

        it('should mark as authenticated after setAuth', () => {
            useAuthStore.getState().setAuth('token', 'id', 'name');
            expect(useAuthStore.getState().isAuthenticated()).toBe(true);
        });

        it('should update values when called again', () => {
            useAuthStore.getState().setAuth('token-1', 'id-1', 'Name1');
            useAuthStore.getState().setAuth('token-2', 'id-2', 'Name2');

            const state = useAuthStore.getState();
            expect(state.token).toBe('token-2');
            expect(state.userId).toBe('id-2');
            expect(state.displayName).toBe('Name2');
        });
    });

    describe('clearAuth', () => {
        it('should clear all auth data', () => {
            useAuthStore.getState().setAuth('token', 'id', 'name');
            useAuthStore.getState().clearAuth();

            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.userId).toBeNull();
            expect(state.displayName).toBeNull();
        });

        it('should mark as not authenticated after clearAuth', () => {
            useAuthStore.getState().setAuth('token', 'id', 'name');
            useAuthStore.getState().clearAuth();
            expect(useAuthStore.getState().isAuthenticated()).toBe(false);
        });

        it('should handle clearing when already cleared', () => {
            useAuthStore.getState().clearAuth();
            const state = useAuthStore.getState();
            expect(state.token).toBeNull();
            expect(state.isAuthenticated()).toBe(false);
        });
    });

    describe('isAuthenticated', () => {
        it('should return false when token is null', () => {
            expect(useAuthStore.getState().isAuthenticated()).toBe(false);
        });

        it('should return true when token is set', () => {
            useAuthStore.getState().setAuth('valid-token', 'user-1', 'User');
            expect(useAuthStore.getState().isAuthenticated()).toBe(true);
        });

        it('should return false after clearAuth', () => {
            useAuthStore.getState().setAuth('token', 'id', 'name');
            useAuthStore.getState().clearAuth();
            expect(useAuthStore.getState().isAuthenticated()).toBe(false);
        });
    });
});
