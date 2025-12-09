import Reveal from 'reveal.js';

export async function createDeck(container: HTMLElement, options: Reveal.Options): Promise<Reveal.Api> {
  const deck = new Reveal(container, options);
  await deck.initialize();
  deck.layout();
  return deck;
}
