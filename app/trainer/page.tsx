'use client';

import RolePlaceholder from '@/components/RolePlaceholder';
import { BookOpen, Film, CalendarDays, TrendingUp, Globe } from 'lucide-react';

export default function TrainerPage() {
  return (
    <RolePlaceholder
      role="trainer"
      Icon={BookOpen}
      title="Trainer app"
      subtitle="Trainer · course delivery"
      blurb="Everything a trainer needs to run the 9-month programme — content, schedule, and progress at a glance."
      features={[
        { Icon: Film,        label: 'Training material — slides, videos, infographics, the manual' },
        { Icon: CalendarDays, label: 'Day-by-day schedule — tap to see what to teach next' },
        { Icon: TrendingUp,  label: 'Track each student & garden through the course' },
        { Icon: Globe,       label: 'All material in the local languages' },
      ]}
    />
  );
}
