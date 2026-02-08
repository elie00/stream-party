const AVATAR_COLORS = [
  '#e53e3e', '#dd6b20', '#d69e2e', '#38a169',
  '#319795', '#3182ce', '#5a67d8', '#805ad5',
  '#d53f8c', '#e53e3e', '#ed8936', '#48bb78',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const color = getColor(name);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`
        rounded-full flex items-center justify-center
        font-semibold text-white flex-shrink-0
        ${sizeClasses[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initial}
    </div>
  );
}
