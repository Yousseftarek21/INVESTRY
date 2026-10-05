import type { useT } from '@/hooks/useTranslation';

// Contexts can't call useT (it's a hook tied to the settings provider), so
// they report a code and the screen showing the toast translates it.
export type SyncErrorCode = 'sync' | 'offline' | 'save' | 'remove' | 'update';

export function syncErrorText(code: SyncErrorCode, t: ReturnType<typeof useT>): string {
  switch (code) {
    case 'sync': return t.syncErrorSync;
    case 'offline': return t.syncErrorOffline;
    case 'save': return t.syncErrorSave;
    case 'remove': return t.syncErrorRemove;
    case 'update': return t.syncErrorUpdate;
  }
}
