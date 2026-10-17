/**
 * The one piece of CSS every generated site gets, whatever the model wrote.
 *
 * Without border-box, a full-width block with side padding comes out wider
 * than the screen, and on a phone the prices and hours run off the right
 * edge. Models leave the reset out often enough that it cannot be left to the
 * prompt. Inserted first in <head> so anything the site itself says wins.
 */
const BASE = `<style>*,*::before,*::after{box-sizing:border-box}img,video{max-width:100%;height:auto}</style>`;

export function withBaseStyle(html: string): string {
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], head[0] + BASE);
  return BASE + html;
}
