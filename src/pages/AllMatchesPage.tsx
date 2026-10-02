import { useAppLayoutContext } from '../components/AppLayout';
import MatchList from '../components/MatchList';
import { useAuth } from '../contexts/AuthContext';

export default function AllMatchesPage() {
  const { allMatches, loadingAll, errorAll, players } = useAppLayoutContext();
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <h1 className="mb-4 text-lg font-black uppercase tracking-wide text-(--color-ink)">
        All Matches
      </h1>
      <MatchList
        matches={allMatches}
        loading={loadingAll}
        error={errorAll}
        currentUserId={user?.id}
        players={players}
        showTeamVersion
        emptyMessage="No matches recorded."
      />
    </div>
  );
}
