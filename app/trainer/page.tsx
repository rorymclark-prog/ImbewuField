'use client';

import RolePlaceholder from '@/components/RolePlaceholder';

export default function TrainerPage() {
  return (
    <RolePlaceholder
      role="trainer"
      icon="📚"
      title="Trainer app"
      subtitle="Trainer · course delivery"
      blurb="Everything a trainer needs to run the 9-month programme — content, schedule, and progress at a glance."
      features={[
        { icon: '🎞', label: 'Training material — slides, videos, infographics, the manual' },
        { icon: '🗓', label: 'Day-by-day schedule — tap to see what to teach next' },
        { icon: '📈', label: 'Track each student & garden through the course' },
        { icon: '🌍', label: 'All material in the local languages' },
      ]}
    />
  );
}
