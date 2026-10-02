import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { GameNight } from '../../types';
import { BottomSheet, Button, ErrorState, useToast } from '../ui';
import { useDeleteNightMutation } from '../../queries/nights';

interface DeleteNightSheetProps {
  /** The night to delete — null keeps the sheet closed. */
  night: GameNight | null;
  /** e.g. "FC27 · Night #3". */
  title: string;
  matchCount: number;
  predictionCount: number;
  jokerCount: number;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Confirmation for deleting a game night, optionally with the matches played that night. */
const DeleteNightSheet: React.FC<DeleteNightSheetProps> = ({
  night, title, matchCount, predictionCount, jokerCount, onClose, onDeleted,
}) => {
  const deleteMutation = useDeleteNightMutation();
  const { toast } = useToast();
  const [deleteMatches, setDeleteMatches] = useState(false);

  // Fresh state each time the sheet opens for a night.
  useEffect(() => {
    setDeleteMatches(false);
    deleteMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night?.id]);

  if (!night) return null;

  const handleDelete = () => {
    deleteMutation.mutate(
      { nightId: night.id, deleteMatches: deleteMatches && matchCount > 0 },
      {
        onSuccess: ({ deletedMatches }) => {
          const kept = deleteMatches ? matchCount - deletedMatches : 0;
          toast({
            title: 'Night deleted',
            detail: deletedMatches > 0
              ? `${title} and ${deletedMatches} match${deletedMatches === 1 ? '' : 'es'} removed.${kept > 0 ? ` ${kept} match${kept === 1 ? '' : 'es'} you can't delete were kept.` : ''}`
              : `${title} removed.`,
            variant: 'success',
          });
          onClose();
          onDeleted?.();
        },
      }
    );
  };

  const busy = deleteMutation.isPending;
  const removed = [
    predictionCount > 0 && `${predictionCount} prediction${predictionCount === 1 ? '' : 's'}`,
    jokerCount > 0 && `${jokerCount} joker${jokerCount === 1 ? '' : 's'} used`,
  ].filter(Boolean).join(' and ');

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="Delete night?"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={busy}
            className="border-red-600! bg-red-600! text-white!"
          >
            <Trash2 className="h-4 w-4" />
            {busy ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-(--color-ink)">
        <span className="font-black uppercase">{title}</span> will be deleted{removed ? `, with its ${removed}` : ''}. This can't be undone.
      </p>

      {matchCount > 0 ? (
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 border-2 border-(--color-ink) bg-white p-3">
          <input
            type="checkbox"
            checked={deleteMatches}
            onChange={e => setDeleteMatches(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-red-600"
          />
          <span className="text-sm text-(--color-ink)">
            <span className="font-bold">Also delete the {matchCount} match{matchCount === 1 ? '' : 'es'} played this night</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {deleteMatches
                ? 'They disappear from standings and stats too.'
                : 'Unticked: the matches stay in your history and stats, just not linked to a night.'}
            </span>
          </span>
        </label>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No matches were played this night.</p>
      )}

      {deleteMutation.error && (
        <ErrorState className="mt-3" message={deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Could not delete the night.'} />
      )}
    </BottomSheet>
  );
};

export default DeleteNightSheet;
