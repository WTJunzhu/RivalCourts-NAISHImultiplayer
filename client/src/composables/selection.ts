import { reactive } from 'vue';
import type { Zone } from '../../../shared/types';

export type SelMode =
  | null
  | 'swap-a' | 'swap-b'
  | 'discard-a' | 'discard-b'
  | 'command'
  | 'envoy'
  | 'peek';

export const sel = reactive({
  mode: null as SelMode,
  // Recruit: click own board cell → talent from same col
  pendingRecruit: null as { zone: Zone; col: number } | null,
  // Addon state (talent col numbers)
  swapA: null as number | null,
  swapB: null as number | null,
  discardA: null as number | null,
  discardB: null as number | null,
  // Command
  commandZone: null as Zone | null,
  commandCol: null as number | null,
  commandTarget: '' as string,
  // Envoy
  envoyTarget: '' as string,
});

export function resetSel() {
  Object.assign(sel, {
    mode: null,
    pendingRecruit: null,
    swapA: null, swapB: null, discardA: null, discardB: null,
    commandZone: null, commandCol: null,
    commandTarget: '', envoyTarget: '',
  });
}
