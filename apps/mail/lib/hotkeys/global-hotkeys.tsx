import { useCommandPalette } from '@/components/context/command-palette-context';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { useShortcuts, useShortcutStore } from './use-hotkey-utils';
import { useQueryState } from 'nuqs';

export function GlobalHotkeys() {
  const [composeOpen, setComposeOpen] = useQueryState('isComposeOpen');
  const { openModal, clearAllFilters } = useCommandPalette();
  const { undoLastAction } = useOptimisticActions();
  const { shortcuts } = useShortcutStore();
  const scope = 'global';

  const handlers = {
    newEmail: () => setComposeOpen('true'),
    commandPalette: () => openModal(),
    clearAllFilters: () => clearAllFilters(),
    undoLastAction: () => {
      undoLastAction();
    },
  };

  const globalShortcuts = shortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(globalShortcuts, handlers, { scope });

  return null;
}
