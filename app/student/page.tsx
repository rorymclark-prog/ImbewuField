'use client';

import RolePlaceholder from '@/components/RolePlaceholder';
import { GraduationCap, CalendarDays, CheckSquare, Video, Award } from 'lucide-react';

export default function StudentPage() {
  return (
    <RolePlaceholder
      role="student"
      Icon={GraduationCap}
      title="Student app"
      subtitle="Student · learn permaculture"
      blurb="The farmer's learning side — work through the 9-month permaculture course at your own pace, on your phone."
      features={[
        { Icon: CalendarDays, label: 'Weekly & daily lessons for the full 9-month course' },
        { Icon: CheckSquare,  label: 'Complete lessons and track your progress' },
        { Icon: Video,        label: 'Short videos + simple guides in your language' },
        { Icon: Award,        label: 'Earn your certificate as you finish' },
      ]}
    />
  );
}
