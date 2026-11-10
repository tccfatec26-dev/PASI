import { installTooltip } from './tooltip.js';
import { installSeg } from './seg.js';
import { installSlide } from './slide.js';
import { installModal } from './modal.js';
import { installMorph } from './morph.js';

/** Liga os comportamentos do protótipo: tooltip, seletor segmentado,
 *  "deslize para confirmar", saída animada das janelas e morph. */
export function installBehaviors() {
  installTooltip();
  installSeg();
  installSlide();
  installModal();
  installMorph();
}
