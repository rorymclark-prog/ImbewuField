import { redirect } from 'next/navigation';

/**
 * There is one crop-planning authority: the mapped, bed-by-bed planner.
 *
 * The former page guessed a 9.6 m² bed for every farmer, kept a second season
 * table, accepted unknown free-text crops as "Plant now", and could count
 * Spinach and Swiss chard twice even though both mapped to the same catalog
 * crop. Keeping a simpler-looking second calculator was not harmless: it gave
 * different planting and kilogram answers from the plan farmers actually use.
 */
export default function PlanPage() {
  redirect('/facilitator/crops');
}
