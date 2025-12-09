import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown/markdown.esm.js';

export const revealConfig: Reveal.Options = {
  embedded: true,
  hash: false,
  width: 1920,
  height: 1080,
  margin: 0.08,
  transition: 'slide',
  backgroundTransition: 'fade',
  display: 'flex',
  center: false,
  plugins: [Markdown],
  markdown: {
    smartypants: true
  },
  // Disable keyboard controls to prevent conflicts with editor
  keyboard: false,
  touch: false,
  loop: false,
  controls: false,
  progress: false,
  overview: false,
  help: false
};