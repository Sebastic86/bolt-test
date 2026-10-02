import { useEffect } from 'react';
import { useAllMatchesQuery } from '../queries/matches';
import { useTeamsQuery } from '../queries/teams';
import { usePlayersQuery } from '../queries/players';
import { usePredictionsQuery } from '../queries/nights';
import { useToast } from '../components/ui/toastContext';
import { runMilestoneWatch } from '../utils/milestoneWatch';

/**
 * Toasts milestones and prediction results when a score lands — on any phone,
 * since realtime sync invalidates the matches query. All seen/shown state is
 * persisted synchronously inside runMilestoneWatch, so re-runs (StrictMode,
 * refetches) never toast twice.
 */
export function useMilestoneWatcher() {
  const { toast } = useToast();
  const { data: matches } = useAllMatchesQuery();
  const { data: teams } = useTeamsQuery();
  const { data: players } = usePlayersQuery();
  const predictionsQuery = usePredictionsQuery(null, { allNights: true });

  // Predictions table missing (migration not applied) → error → skip prediction toasts.
  const predictions = predictionsQuery.data ?? (predictionsQuery.isError ? null : undefined);

  useEffect(() => {
    if (!matches || !teams || !players || predictions === undefined) return;
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }
    const toasts = runMilestoneWatch({ matches, teams, players, predictions, storage, now: Date.now() });
    for (const t of toasts) toast(t);
  }, [matches, teams, players, predictions, toast]);
}
