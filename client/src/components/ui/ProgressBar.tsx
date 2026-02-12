/**
 * Progress bar component for download/upload progress
 */
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  progress,
  label,
  sublabel,
  size = 'md',
  variant = 'default',
  showPercentage = true,
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variantClasses = {
    default: 'bg-purple-600',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="w-full">
      {/* Labels */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1 text-xs">
          {label && <span className="text-[#a0a0a0]">{label}</span>}
          {showPercentage && (
            <span className="text-[#a0a0a0] font-mono">
              {clampedProgress.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn(
          'w-full bg-[#333] rounded-full overflow-hidden',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variantClasses[variant],
            animated && clampedProgress < 100 && 'animate-pulse'
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* Sublabel */}
      {sublabel && (
        <div className="text-xs text-[#666] mt-1">{sublabel}</div>
      )}
    </div>
  );
}

/**
 * Circular progress indicator
 */
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function CircularProgress({
  progress,
  size = 48,
  strokeWidth = 4,
  label,
}: CircularProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#333"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#7c3aed"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      {/* Center text */}
      {label && (
        <span className="absolute text-xs font-mono text-[#a0a0a0]">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Connection status indicator
 */
interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  label?: string;
}

export function ConnectionStatus({ status, label }: ConnectionStatusProps) {
  const statusConfig = {
    connected: { color: 'bg-green-500', text: 'Connected' },
    connecting: { color: 'bg-yellow-500 animate-pulse', text: 'Connecting...' },
    disconnected: { color: 'bg-gray-500', text: 'Disconnected' },
    error: { color: 'bg-red-500', text: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', config.color)} />
      <span className="text-xs text-[#a0a0a0]">{label || config.text}</span>
    </div>
  );
}
