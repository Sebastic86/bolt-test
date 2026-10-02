import { useCallback, useState } from 'react';
import { useToast } from '../ui';
import { IosInstallSheet } from './IosInstallSheet';
import { promptInstall, useInstallMode } from '../../lib/installApp';

/** Install action shared by the dashboard card and the account menu. */
export function useInstallFlow() {
  const mode = useInstallMode();
  const { toast } = useToast();
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const closeIosSheet = useCallback(() => setIosSheetOpen(false), []);

  const start = async () => {
    if (mode === 'ios') {
      setIosSheetOpen(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      toast({ title: 'Installed', detail: 'Open the app from your home screen.', variant: 'success' });
    }
  };

  const sheet = <IosInstallSheet isOpen={iosSheetOpen} onClose={closeIosSheet} />;
  return { mode, canInstall: mode === 'prompt' || mode === 'ios', start, sheet };
}
