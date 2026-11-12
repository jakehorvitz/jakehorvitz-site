/* jakehorvitz.com, Stage Night. Wires the modules: the soundcheck hands the room to the stage, the headline
   stands on the strings, and the rest of the page plays its parts. */

import { $, $$ } from './lib.js';
import { Strings } from './strings.js';
import { initStage } from './stage.js';
import { initHero } from './hero.js';
import { runIntro } from './intro.js';
import { initNav } from './nav.js';
import { InkLine } from './ink.js';
import { initShow } from './show.js';
import { initRail } from './rail.js';
import { initScenes } from './scenes.js';
import { initReveals } from './reveal.js';
import { initBass } from './bass.js';

const root = document.documentElement;
const heroEl = $('#top');
const strings = new Strings(4);
const stage = initStage(heroEl, $('#stage'), strings);
const hero = initHero({ hero: heroEl, strings, stage });

/* Real loading the tuner waits on: the type, the agents' faces, and the page itself. */
const fonts = document.fonts
  ? Promise.all(['800 32px Archivo', '400 16px Archivo', '400 12px "Martian Mono"'].map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => hero.relayout(true))
  : Promise.resolve();
const faces = $$('.checkin-face img').map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));

const intro = root.classList.contains('intro-on');
runIntro({
  root, stage, strings,
  tasks: [fonts, loaded, ...faces],
  onHandoff: () => { if (intro) hero.play(); else hero.idle(); }
});

initNav();
$$('[data-ink]').forEach((box) => InkLine(box));
initShow($('[data-show]'));
$$('[data-rail]').forEach(initRail);
initScenes();
initBass($('[data-bass]'), { gl: stage.gl });
initReveals();
