'use client';

import RolePlaceholder from '@/components/RolePlaceholder';

export default function StudentPage() {
  return (
    <RolePlaceholder
      role="student"
      icon="🎓"
      title="Student app"
      subtitle="Student · learn permaculture"
      blurb="The farmer's learning side — work through the 9-month permaculture course at your own pace, on your phone."
      features={[
        { icon: '📅', label: 'Weekly & daily lessons for the full 9-month course' },
        { icon: '✅', label: 'Complete lessons and track your progress' },
        { icon: '🎬', label: 'Short videos + simple guides in your language' },
        { icon: '🏅', label: 'Earn your certificate as you finish' },
      ]}
    />
  );
}
