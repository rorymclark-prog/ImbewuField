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
        <div className="font-display font-semibold mb-1" style={{ fontSize: 16, color: '#20190F' }}>
          {title}
        </div>
      )}
      <div className="font-sans" style={{ fontSize: 13, color: '#8C7A62', maxWidth: 280 }}>
        {message}
      </div>
    </div>
  );
}
