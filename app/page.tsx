import { redirect } from 'next/navigation';

// The app's landing is the role hub — farmers, supervisors, mentors, NGOs etc.
// choose where to go instead of being dropped straight onto the map.
export default function Page() {
  redirect('/home');
}
