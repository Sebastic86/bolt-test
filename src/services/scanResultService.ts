/**
 * "Scan the result": downsizes a photo of the EA FC full-time screen in the
 * browser and sends it to the `scan-match-result` Edge Function, which reads
 * the score with a vision model (supabase/functions/scan-match-result).
 * The photo isn't stored; mapping onto team1/team2 happens in utils/scanResult.
 */
import { supabase } from '../lib/supabaseClient';
import { ScanReading } from '../utils/scanResult';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't open that photo. Try a JPEG or PNG."));
    };
    img.src = url;
  });
}

/** Phone photos are 3–12 MB; a 1600px JPEG (~200–400 KB) is plenty to read a scoreboard. */
export async function photoToJpegBase64(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Couldn't process the photo on this device.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).replace(/^data:image\/jpeg;base64,/, '');
}

export async function scanMatchResult(file: File, teams: [string, string]): Promise<ScanReading> {
  const image = await photoToJpegBase64(file);
  const { data, error } = await supabase.functions.invoke<{ reading?: ScanReading; error?: string }>('scan-match-result', {
    body: { image, mediaType: 'image/jpeg', teams },
  });
  if (error) throw new Error('Scanning failed. Check your connection or enter the score by hand.');
  if (!data?.reading) throw new Error(data?.error ?? 'Scanning failed.');
  return data.reading;
}
