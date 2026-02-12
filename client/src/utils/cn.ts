/**
 * Utility function to merge class names
 * A simple implementation of clsx/cn
 */
type ClassValue = string | undefined | null | false;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
