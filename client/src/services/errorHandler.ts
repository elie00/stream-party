/**
 * Centralized error handling service
 */
import { useToastStore } from '../components/ui/Toast';

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Room errors
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  NOT_HOST = 'NOT_HOST',
  
  // Torrent errors
  INVALID_MAGNET = 'INVALID_MAGNET',
  TORRENT_ERROR = 'TORRENT_ERROR',
  NO_VIDEO_FILES = 'NO_VIDEO_FILES',
  
  // WebRTC errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CALL_ERROR = 'CALL_ERROR',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: Error;
}

/**
 * Create a standardized application error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  originalError?: Error
): AppError {
  return {
    code,
    message,
    details,
    originalError,
  };
}

/**
 * Parse unknown errors into AppError
 */
export function parseError(error: unknown): AppError {
  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // DOMException (permissions, etc.)
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return createError(
        ErrorCode.PERMISSION_DENIED,
        'Camera/microphone permission denied',
        { name: error.name },
        error
      );
    }
    if (error.name === 'NotFoundError') {
      return createError(
        ErrorCode.CALL_ERROR,
        'No camera/microphone found',
        { name: error.name },
        error
      );
    }
  }

  // Error instance
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return createError(
        ErrorCode.NETWORK_ERROR,
        'Network connection error',
        { originalMessage: error.message },
        error
      );
    }

    // Timeout
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return createError(
        ErrorCode.TIMEOUT,
        'Request timed out',
        { originalMessage: error.message },
        error
      );
    }

    // Torrent errors
    if (error.message.includes('torrent') || error.message.includes('magnet')) {
      return createError(
        ErrorCode.TORRENT_ERROR,
        error.message,
        { originalMessage: error.message },
        error
      );
    }

    // Generic error
    return createError(
      ErrorCode.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred',
      { originalMessage: error.message },
      error
    );
  }

  // String error
  if (typeof error === 'string') {
    return createError(ErrorCode.UNKNOWN_ERROR, error);
  }

  // Unknown error type
  return createError(
    ErrorCode.UNKNOWN_ERROR,
    'An unexpected error occurred',
    { error }
  );
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Get user-friendly error message
 */
export function getUserMessage(error: AppError): string {
  switch (error.code) {
    case ErrorCode.NETWORK_ERROR:
      return 'Unable to connect. Please check your internet connection.';
    case ErrorCode.TIMEOUT:
      return 'The request took too long. Please try again.';
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.TOKEN_EXPIRED:
      return 'Your session has expired. Please log in again.';
    case ErrorCode.ROOM_NOT_FOUND:
      return 'Room not found. It may have been closed.';
    case ErrorCode.ROOM_FULL:
      return 'This room is full. Maximum 6 participants allowed.';
    case ErrorCode.NOT_HOST:
      return 'Only the host can perform this action.';
    case ErrorCode.INVALID_MAGNET:
      return 'Invalid magnet link. Please check the format.';
    case ErrorCode.TORRENT_ERROR:
      return 'Failed to load torrent. Please try another link.';
    case ErrorCode.NO_VIDEO_FILES:
      return 'No video files found in this torrent.';
    case ErrorCode.PERMISSION_DENIED:
      return 'Camera/microphone access denied. Please allow permissions in your browser.';
    case ErrorCode.CALL_ERROR:
      return 'Failed to start call. Please try again.';
    case ErrorCode.VALIDATION_ERROR:
      return error.message || 'Invalid input. Please check your data.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Error handler class for centralized error management
 */
class ErrorHandler {
  private toastStore = useToastStore;

  /**
   * Handle an error with logging and user notification
   */
  handle(error: unknown, context?: string): AppError {
    const appError = parseError(error);
    const userMessage = getUserMessage(appError);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context || 'Error'}]`, appError);
    }

    // Show toast to user
    this.toastStore.getState().addToast(userMessage, 'error');

    return appError;
  }

  /**
   * Handle an error silently (log only, no toast)
   */
  handleSilent(error: unknown, context?: string): AppError {
    const appError = parseError(error);

    // Log to console
    console.error(`[${context || 'Error'}]`, appError);

    return appError;
  }

  /**
   * Handle an error with custom message
   */
  handleWithMessage(error: unknown, customMessage: string, context?: string): AppError {
    const appError = parseError(error);

    // Log to console
    console.error(`[${context || 'Error'}]`, appError);

    // Show custom toast
    this.toastStore.getState().addToast(customMessage, 'error');

    return appError;
  }
}

export const errorHandler = new ErrorHandler();
