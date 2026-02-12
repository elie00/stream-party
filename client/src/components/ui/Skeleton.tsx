/**
 * Skeleton loader component for loading states
 */
import { cn } from '../../utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-[#333]',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/**
 * Skeleton for chat message
 */
export function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-3">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width={100} height={14} />
        <Skeleton variant="text" width="80%" height={14} />
      </div>
    </div>
  );
}

/**
 * Skeleton for participant list
 */
export function ParticipantSkeleton() {
  return (
    <div className="flex -space-x-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} variant="circular" width={32} height={32} className="border-2 border-[#1a1a1a]" />
      ))}
    </div>
  );
}

/**
 * Skeleton for video card
 */
export function VideoCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-3 space-y-2">
        <Skeleton variant="text" width="70%" height={16} />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header skeleton */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3 flex items-center justify-between">
        <Skeleton variant="text" width={150} height={24} />
        <div className="flex gap-2">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex">
        {/* Video area */}
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="text-center">
            <Skeleton variant="circular" width={48} height={48} className="mx-auto mb-3" />
            <Skeleton variant="text" width={120} height={14} className="mx-auto" />
          </div>
        </div>

        {/* Chat sidebar skeleton */}
        <div className="w-80 bg-[#1a1a1a] border-l border-[#333] hidden lg:block">
          <div className="border-b border-[#333] px-4 py-3">
            <Skeleton variant="text" width={60} height={20} />
          </div>
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
