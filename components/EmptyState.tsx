import Illustration from '@/components/Illustration';

export interface EmptyStateProps {
  title?: string;
  message: string;
  className?: string;
}

export default function EmptyState({ title, message, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      <Illustration name="empty-sprout" className="mb-4" />
      {title && (
        <div className="font-display font-semibold mb-1" style={{ fontSize: 16, color: 'var(--color-ink)' }}>
          {title}
        </div>
      )}
      <div className="font-sans" style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 280 }}>
        {message}
      </div>
    </div>
  );
}
