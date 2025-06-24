import { useShortcuts, useShortcutStore } from './use-hotkey-utils';
import { keyboardShortcuts } from '@/config/shortcuts';
import { useQueryState } from 'nuqs';

export function ComposeHotkeys() {
  const scope = 'compose';
  const [isComposeOpen, setIsComposeOpen] = useQueryState('isComposeOpen');
  const { shortcuts } = useShortcutStore();

  const handlers = {
    closeCompose: () => {
      if (isComposeOpen === 'true') {
        setIsComposeOpen('false');
      }
    },
  };

  const composeShortcuts = shortcuts.filter((shortcut) => shortcut.scope === scope);

  useShortcuts(composeShortcuts, handlers, { scope });

  return null;
}
