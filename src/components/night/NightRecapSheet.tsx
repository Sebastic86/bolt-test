import React, { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { RecapData, recapFileName } from '../../utils/recapData';
import { renderRecapPng } from '../../utils/recapCard';
import { BottomSheet, Button, ErrorState } from '../ui';

interface NightRecapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  data: RecapData | null;
}

type ImageState =
  | { status: 'idle' | 'rendering' }
  | { status: 'ready'; blob: Blob; url: string }
  | { status: 'error'; message: string };

/**
 * On-screen recap of a night plus a "Share" button that shares a PNG
 * rendered on a canvas. The PNG is pre-rendered when the sheet opens:
 * iOS Safari only allows navigator.share({ files }) synchronously inside
 * the tap handler, so nothing may be awaited between the tap and share().
 */
const NightRecapSheet: React.FC<NightRecapSheetProps> = ({ isOpen, onClose, data }) => {
  const [image, setImage] = useState<ImageState>({ status: 'idle' });
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (!isOpen || !data) return;
    let cancelled = false;
    let url: string | null = null;
    setImage({ status: 'rendering' });
    setShowImage(false);

    renderRecapPng(data)
      .then(blob => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ status: 'ready', blob, url });
      })
      .catch((error: unknown) => {
        if (!cancelled) setImage({ status: 'error', message: error instanceof Error ? error.message : 'Could not create the image.' });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, data]);

  if (!data) return null;

  const fileName = recapFileName(data.title);

  const handleShare = () => {
    if (image.status !== 'ready') return;
    const file = new File([image.blob], fileName, { type: 'image/png' });
    const shareData: ShareData = { files: [file], title: data.title };
    if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
      navigator.share(shareData).catch((error: unknown) => {
        // AbortError = the user closed the share sheet; anything else → offer the image instead.
        if (!(error instanceof DOMException && error.name === 'AbortError')) setShowImage(true);
      });
      return;
    }
    setShowImage(true);
  };

  const { playerOfTheNight: potn } = data;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Night recap"
      footer={
        <Button className="w-full" onClick={handleShare} disabled={image.status !== 'ready'}>
          <Share2 className="h-4 w-4" />
          {image.status === 'rendering' ? 'Preparing image…' : 'Share'}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="border-b-[3px] border-(--color-green-bright) bg-(--color-ink) p-3 text-white">
          <p className="text-[10px] font-black uppercase tracking-wide text-(--color-green-bright)">Game night recap</p>
          <h3 className="truncate text-xl font-black uppercase tracking-wide">{data.title}</h3>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-300">{data.subtitle}</p>
        </div>

        <div className="border-2 border-(--color-ink) bg-white p-3 shadow-hard">
          <p className="text-xs font-black uppercase tracking-wide text-(--color-green-mid)">Player of the night</p>
          {potn ? (
            <>
              <p className="truncate text-2xl font-black uppercase tracking-wide text-(--color-ink)">{data.playerOfTheNightName ?? potn.name}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 tabular-nums">
                {potn.wins}W {potn.losses}L · {potn.points} pts · GD {potn.gd}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold uppercase text-gray-500">No results yet</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-(--color-ink)">Final table</p>
          {data.table.length === 0 ? (
            <p className="border-2 border-(--color-ink) bg-white p-3 text-center text-sm text-gray-500">No scored matches.</p>
          ) : (
            <div className="border-2 border-(--color-ink) bg-white">
              <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem_2.5rem] items-center gap-1 bg-(--color-ink) px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                <span>#</span>
                <span>Player</span>
                <span className="text-right">W</span>
                <span className="text-right">L</span>
                <span className="text-right">GD</span>
                <span className="text-right text-(--color-green-bright)">Pts</span>
              </div>
              {data.table.map((row, i) => (
                <div
                  key={row.playerId}
                  className="grid min-h-10 grid-cols-[1.5rem_1fr_2rem_2rem_2.5rem_2.5rem] items-center gap-1 border-t border-gray-200 px-2 text-sm"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center text-[11px] font-black text-white ${i === 0 ? 'bg-(--color-green-bright)' : 'bg-(--color-ink)'}`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate font-black uppercase text-(--color-ink)">{row.name}</span>
                  <span className="text-right font-black tabular-nums">{row.wins}</span>
                  <span className="text-right font-black tabular-nums">{row.losses}</span>
                  <span className="text-right font-black tabular-nums">{row.gd}</span>
                  <span className="text-right font-black tabular-nums text-(--color-green-mid)">{row.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Tile label="Matches" value={data.matchCount} />
          <Tile label="Goals" value={data.totalGoals} />
          <Tile label="Penalties" value={data.penaltyCount} />
        </div>

        {data.biggestWin && (
          <div className="border-2 border-(--color-ink) bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-(--color-green-mid)">Biggest win</p>
            <p className="text-sm font-black uppercase text-(--color-ink)">
              {data.biggestWin.winnerTeam} <span className="tabular-nums">{data.biggestWin.score}</span> {data.biggestWin.loserTeam}
            </p>
            <p className="truncate text-xs text-gray-500">
              {data.biggestWin.winnerPlayers.join(' & ')} vs {data.biggestWin.loserPlayers.join(' & ')}
            </p>
          </div>
        )}

        {data.predictionChampion && (
          <div className="border-2 border-(--color-ink) bg-white p-3">
            <p className="text-xs font-black uppercase tracking-wide text-(--color-green-mid)">Prediction champion</p>
            <p className="text-sm font-black uppercase text-(--color-ink)">
              {data.predictionChampion.name} · <span className="tabular-nums">{data.predictionChampion.points} pts</span>
            </p>
            <p className="text-xs text-gray-500 tabular-nums">
              {data.predictionChampion.correct}/{data.predictionChampion.settled} correct · {data.predictionChampion.exact} exact
            </p>
          </div>
        )}

        {data.scoredCount < data.matchCount && (
          <p className="text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {data.matchCount - data.scoredCount} match{data.matchCount - data.scoredCount === 1 ? '' : 'es'} without a score
          </p>
        )}

        {image.status === 'error' && <ErrorState message={`Couldn't create the share image: ${image.message}`} />}

        {showImage && image.status === 'ready' && (
          <div className="space-y-2">
            <p className="text-center text-xs font-bold uppercase tracking-wide text-gray-500">
              Long-press the image to save or share it
            </p>
            <img src={image.url} alt={`${data.title} recap`} className="w-full border-2 border-(--color-ink)" />
            <a
              href={image.url}
              download={fileName}
              className="flex h-10 w-full items-center justify-center gap-2 border-2 border-(--color-ink) bg-white text-sm font-bold uppercase tracking-wide text-(--color-ink)"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-(--color-ink) bg-white py-2 text-center">
      <div className="text-xl font-black tabular-nums text-(--color-ink)">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

export default NightRecapSheet;
