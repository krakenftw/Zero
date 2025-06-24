// TODO: Implement shortcuts syncing and caching
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Shortcut, keyboardShortcuts } from '@/config/shortcuts';
import { useTRPC } from '@/providers/query-provider';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCallback, useMemo } from 'react';

export const useShortcutStore = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: shortcuts } = useQuery(trpc.shortcut.get.queryOptions());

  const {
    mutateAsync: updateShortcuts,
    isPending: isUpdating,
    error: updateError,
  } = useMutation(trpc.shortcut.update.mutationOptions());

  const {
    mutateAsync: pruneShortcuts,
    isPending: isPruning,
    error: pruneError,
  } = useMutation(trpc.shortcut.prune.mutationOptions());

  const overrideShortcuts = useCallback(() => {
    const userShortcuts = shortcuts?.shortcuts?.shortcuts ?? [];
    return keyboardShortcuts.map((shortcut) => {
      const overridedShortcut = userShortcuts.find((s) => s.action === shortcut.action);
      if (overridedShortcut) {
        return overridedShortcut;
      }
      return shortcut;
    });
  }, [shortcuts, keyboardShortcuts]);

  const resetShortcuts = useCallback(async () => {
    try {
      await pruneShortcuts();
      queryClient.invalidateQueries({ queryKey: trpc.shortcut.get.queryKey() });
    } catch (error) {
      console.error('Error resetting shortcuts:', error);
      throw error;
    }
  }, [pruneShortcuts, queryClient, trpc.shortcut.get]);

  const updateShortcut = useCallback(
    async (shortcut: Shortcut) => {
      const currentShortcuts = shortcuts?.shortcuts?.shortcuts ?? [];
      const index = currentShortcuts?.findIndex((s) => s.action === shortcut.action);
      let newShortcuts: Shortcut[];
      if (index !== undefined && index >= 0) {
        newShortcuts = [
          ...(currentShortcuts?.slice(0, index) || []),
          shortcut,
          ...(currentShortcuts?.slice(index + 1) || []),
        ];
      } else {
        newShortcuts = [...(currentShortcuts || []), shortcut];
      }

      // update the local cache immediately
      queryClient.setQueryData(trpc.shortcut.get.queryKey(), (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          shortcuts: {
            ...oldData.shortcuts,
            shortcuts: newShortcuts,
          },
        };
      });

      try {
        await updateShortcuts({ shortcuts: newShortcuts });
      } catch (error) {
        // revert on error
        console.error('Error updating shortcuts:', error);
        queryClient.setQueryData(trpc.shortcut.get.queryKey(), shortcuts);
        throw error;
      }
    },

    [shortcuts, queryClient, updateShortcuts, trpc.shortcut.get],
  );

  return {
    shortcuts: overrideShortcuts(),
    updateShortcut,
    resetShortcuts,
    isUpdating,
    isPruning,
    updateError,
    pruneError,
  };
};

export const isMac =
  typeof window !== 'undefined' &&
  (/macintosh|mac os x/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const isDvorak =
  typeof window !== 'undefined' &&
  (navigator.language === 'en-DV' ||
    navigator.languages?.includes('en-DV') ||
    document.documentElement.lang === 'en-DV');

const dvorakToQwerty: Record<string, string> = {
  a: 'a',
  b: 'x',
  c: 'j',
  d: 'e',
  e: '.',
  f: 'u',
  g: 'i',
  h: 'd',
  i: 'c',
  j: 'h',
  k: 't',
  l: 'n',
  m: 'm',
  n: 'b',
  o: 'r',
  p: 'l',
  q: "'",
  r: 'p',
  s: 'o',
  t: 'k',
  u: 'g',
  v: 'q',
  w: ',',
  x: 'z',
  y: 'f',
  z: ';',
  ';': 's',
  "'": '-',
  ',': 'w',
  '.': 'v',
  '/': 'z',
  '-': '[',
  '[': '/',
  ']': '=',
  '=': ']',
};

const qwertyToDvorak: Record<string, string> = Object.entries(dvorakToQwerty).reduce(
  (acc, [dvorak, qwerty]) => ({ ...acc, [qwerty]: dvorak }),
  {},
);

export const formatKeys = (keys: string[] | undefined): string => {
  if (!keys || !keys.length) return '';

  const mapKey = (key: string) => {
    const mappedKey = isDvorak ? qwertyToDvorak[key] || key : key;

    switch (mappedKey) {
      case 'mod':
        return isMac ? 'meta' : 'control';
      case '⌘':
        return 'meta';
      case '#':
        return 'shift+3';
      case '!':
        return 'shift+1';
      default:
        return mappedKey.toLowerCase();
    }
  };

  if (keys.length > 1) {
    return keys.map(mapKey).join('+');
  }

  const firstKey = keys[0];
  if (!firstKey) return '';
  return mapKey(firstKey);
};

export const formatDisplayKeys = (keys: string[]): string[] => {
  return keys.map((key) => {
    const lowerKey = key.toLowerCase();
    const mappedKey = isDvorak ? qwertyToDvorak[lowerKey] || key : key;

    switch (mappedKey) {
      case 'mod':
        return isMac ? '⌘' : 'Ctrl';
      case 'meta':
        return '⌘';
      case 'control':
        return 'Ctrl';
      case 'shift':
        return '⇧';
      case 'alt':
        return isMac ? '⌥' : 'Alt';
      case 'enter':
        return '↵';
      case 'escape':
        return 'Esc';
      case 'backspace':
        return '⌫';
      case 'delete':
        return '⌦';
      case 'space':
        return 'Space';
      case 'click':
        return 'Click';
      default:
        return mappedKey.length === 1 ? mappedKey.toUpperCase() : mappedKey;
    }
  });
};

export type HotkeyOptions = {
  scope: string;
  preventDefault?: boolean;
  keydown?: boolean;
  keyup?: boolean;
};

export const defaultHotkeyOptions: HotkeyOptions = {
  scope: 'global',
  preventDefault: false,
  keydown: true,
  keyup: false,
};

export function useShortcut(
  shortcut: Shortcut,
  callback: () => void,
  options: Partial<HotkeyOptions> = {},
) {
  // const { updateShortcut } = useShortcutCache();
  const { scope, preventDefault, ...restOptions } = {
    ...defaultHotkeyOptions,
    ...options,
    ...shortcut,
  };

  // useCallback(() => {
  //   updateShortcut(shortcut);
  // }, [shortcut, updateShortcut])();

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (shortcut.preventDefault || preventDefault) {
        event.preventDefault();
      }
      callback();
    },
    [callback, preventDefault, shortcut],
  );

  useHotkeys(
    formatKeys(shortcut.keys),
    handleKey,
    {
      ...restOptions,
      scopes: [scope],
      preventDefault: shortcut.preventDefault || preventDefault,
    },
    [handleKey],
  );
}

export function useShortcuts(
  shortcuts: Shortcut[],
  handlers: { [key: string]: () => void },
  options: Partial<HotkeyOptions> = {},
) {
  const shortcutMap = useMemo(() => {
    return shortcuts.reduce<Record<string, Shortcut>>((acc, shortcut) => {
      if (handlers[shortcut.action]) {
        acc[shortcut.action] = shortcut;
      }
      return acc;
    }, {});
  }, [shortcuts]);

  const shortcutString = useMemo(() => {
    return Object.entries(shortcutMap)
      .map(([action, shortcut]) => {
        if (handlers[action]) {
          return formatKeys(shortcut.keys);
        }
        return null;
      })
      .filter(Boolean)
      .join(',');
  }, [shortcutMap, handlers]);

  useHotkeys(
    shortcutString,
    (event: KeyboardEvent, hotkeysEvent) => {
      if (hotkeysEvent.keys?.includes('click')) {
        return;
      }
      const getModifierString = (e: typeof hotkeysEvent) => {
        console.log(e);
        const modifiers = [];
        if (e.meta) modifiers.push('meta');
        if (e.ctrl) modifiers.push('control');
        if (e.alt) modifiers.push('alt');
        if (e.shift) modifiers.push('shift');
        return modifiers.length > 0 ? modifiers.join('+') + '+' : '';
      };

      const pressedKeys = getModifierString(hotkeysEvent) + (hotkeysEvent.keys?.join('+') || '');

      const matchingEntry = Object.entries(shortcutMap).find(
        ([_, shortcut]) => formatKeys(shortcut.keys) === pressedKeys,
      );

      if (matchingEntry) {
        const [action, shortcut] = matchingEntry;
        const handlerFn = handlers[action];
        if (handlerFn) {
          if (shortcut.preventDefault || options.preventDefault) {
            event.preventDefault();
          }
          handlerFn();
        }
      }
    },
    {
      ...options,
      scopes: options.scope ? [options.scope] : undefined,
      preventDefault: false, // We'll handle preventDefault per-shortcut
      keyup: false,
      keydown: true,
    },
    [shortcutMap, handlers, options],
  );
}
