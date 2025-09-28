import mermaid from 'mermaid';
import { JSDOM } from 'jsdom';

let initialized = false;

function ensureMermaidEnvironment() {
  if (initialized) {
    return;
  }

  const dom = new JSDOM('<div id="mermaid-root"></div>', {
    pretendToBeVisual: true,
  });

  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: Window }).window = dom.window as unknown as Window;
  }
  if (typeof globalThis.document === 'undefined') {
    (globalThis as unknown as { document: Document }).document = dom.window.document;
  }
  if (typeof globalThis.navigator === 'undefined') {
    (globalThis as unknown as { navigator: Navigator }).navigator = dom.window.navigator;
  }
  if (typeof globalThis.getComputedStyle === 'undefined') {
    (globalThis as unknown as { getComputedStyle: typeof dom.window.getComputedStyle }).getComputedStyle =
      dom.window.getComputedStyle.bind(dom.window);
  }
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    (globalThis as unknown as { requestAnimationFrame: typeof dom.window.requestAnimationFrame }).requestAnimationFrame =
      dom.window.requestAnimationFrame.bind(dom.window);
  }
  if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    (globalThis as unknown as { cancelAnimationFrame: typeof dom.window.cancelAnimationFrame }).cancelAnimationFrame =
      dom.window.cancelAnimationFrame.bind(dom.window);
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    logLevel: 'fatal',
  });

  initialized = true;
}

export async function renderMermaidDiagram(diagram: string): Promise<string> {
  ensureMermaidEnvironment();

  const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { svg } = await mermaid.render(renderId, diagram);
  return svg;
}
