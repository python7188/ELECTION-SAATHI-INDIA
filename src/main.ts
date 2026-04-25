/**
 * Election Saathi India — Main Entry Point
 *
 * Bootstraps the complete election education application:
 * 1. 3D WebGL election journey scene
 * 2. Accessible DOM fallback layer
 * 3. Election Coach (Gemini AI) panel
 * 4. Google Calendar reminder widget
 * 5. Google Maps polling location widget
 *
 * @module main
 */

import { ElectionScene } from './scene/ElectionScene';
import { AccessibleFallback } from './ui/AccessibleFallback';
import { ElectionCoachPanel } from './ui/ElectionCoachPanel';
import { TranslationWidget } from './ui/TranslationWidget';
import { MapsWidget } from './ui/MapsWidget';
import { store } from './state/store';
import { announce, onReducedMotionChange, prefersReducedMotion } from './utils/a11y';

/** Track initialised modules for cleanup. */
let scene: ElectionScene | null = null;

/**
 * Bootstrap the Election Saathi India application.
 *
 * Initialises all UI layers in priority order:
 * 1. Accessible fallback (always first — ensures a11y from the start)
 * 2. 3D scene (progressive enhancement)
 * 3. Coach panel, Translation, Maps widgets
 *
 * @throws Error if the #app root element is missing.
 */
function bootstrap(): void {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('[ElectionSaathi] #app root element not found.');
  }

  // 1. Accessible fallback — always renders first
  try {
    new AccessibleFallback();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ElectionSaathi] Accessible fallback failed to initialise:', e);
  }

  // 2. 3D WebGL scene — progressive enhancement
  const shouldEnable3D = !prefersReducedMotion() && supportsWebGL();
  if (shouldEnable3D) {
    try {
      scene = new ElectionScene(appContainer);
      store.setState({ is3DEnabled: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ElectionSaathi] 3D scene failed to initialise:', e);
      store.setState({ is3DEnabled: false });
      appContainer.setAttribute('aria-hidden', 'true');
    }
  } else {
    store.setState({ is3DEnabled: false });
    appContainer.style.display = 'none';
    appContainer.setAttribute('aria-hidden', 'true');
  }

  // 3. Election Coach panel (Gemini AI)
  try {
    new ElectionCoachPanel();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ElectionSaathi] Coach panel failed:', e);
  }

  // 4. Translation widget
  try {
    new TranslationWidget();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ElectionSaathi] Translation widget failed:', e);
  }

  // 5. Maps widget
  try {
    new MapsWidget();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ElectionSaathi] Maps widget failed:', e);
  }

  // Listen for reduced-motion changes
  onReducedMotionChange((reduced) => {
    store.setState({ isReducedMotion: reduced });
    if (reduced && scene) {
      scene.dispose();
      scene = null;
      store.setState({ is3DEnabled: false });
    }
  });

  // Announce app ready
  announce('Election Saathi India is ready. Navigate through the election journey to learn about Indian elections.');

  // Scroll spy for nav
  setupScrollSpy();
}

/**
 * Check if the browser supports WebGL.
 *
 * @returns True if WebGL is available.
 */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') || canvas.getContext('webgl')
    );
  } catch {
    return false;
  }
}

/**
 * Set up intersection observer for scroll-based nav highlighting.
 */
function setupScrollSpy(): void {
  const sections = document.querySelectorAll('main > section[id]');
  if (sections.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          store.setState({ activeSection: entry.target.id });
        }
      });
    },
    { threshold: 0.3 },
  );

  sections.forEach((section) => observer.observe(section));
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', bootstrap);

export { bootstrap };
