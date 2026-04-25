/**
 * Accessibility Helpers — Utilities for the ARIA fallback layer.
 *
 * Provides functions for screen reader announcements, focus management,
 * keyboard navigation, reduced-motion detection, and live region updates.
 *
 * @module utils/a11y
 */

/**
 * Announce a message to screen readers via the ARIA live region.
 *
 * @param message - Plain text message to announce.
 * @param priority - 'polite' for non-urgent, 'assertive' for immediate.
 */
export function announce(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
): void {
  const announcer = document.getElementById('aria-announcer');
  if (!announcer) {
    return;
  }

  announcer.setAttribute('aria-live', priority);
  // Clear and re-set to force re-announcement
  announcer.textContent = '';
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

/**
 * Move focus to a specific element by ID.
 *
 * @param elementId - The ID of the target element.
 * @param options - Optional focus options.
 * @returns True if focus was successfully moved.
 */
export function moveFocusTo(
  elementId: string,
  options: FocusOptions = { preventScroll: false },
): boolean {
  const element = document.getElementById(elementId);
  if (!element) {
    return false;
  }

  // Make focusable if not naturally focusable
  if (!element.getAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }

  element.focus(options);
  return true;
}

/**
 * Trap focus within a container (for modals and panels).
 *
 * @param containerId - The container element ID.
 * @returns A cleanup function that removes the trap.
 */
export function trapFocus(containerId: string): () => void {
  const container = document.getElementById(containerId);
  if (!container) {
    return () => {};
  }

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Detect if the user prefers reduced motion.
 *
 * @returns True if the user has enabled reduced motion preferences.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Listen for changes in reduced-motion preference.
 *
 * @param callback - Function called with the new preference value.
 * @returns Cleanup function to stop listening.
 */
export function onReducedMotionChange(callback: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event: MediaQueryListEvent): void => {
    callback(event.matches);
  };

  query.addEventListener('change', handler);
  return () => {
    query.removeEventListener('change', handler);
  };
}

/**
 * Generate a unique ID for accessible elements.
 *
 * @param prefix - ID prefix describing the element's purpose.
 * @returns A unique string ID.
 */
export function generateA11yId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}

/**
 * Set the document's active section for navigation state.
 *
 * Updates ARIA current attributes on nav links.
 *
 * @param sectionId - The currently active section ID.
 */
export function setActiveNavSection(sectionId: string): void {
  const navLinks = document.querySelectorAll<HTMLElement>('.nav-link');
  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    const isActive = href === `#${sectionId}`;
    if (isActive) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Create a visually hidden but accessible text element.
 *
 * @param text - The text content.
 * @param tag - HTML tag to use (default: 'span').
 * @returns The created element.
 */
export function createScreenReaderText(text: string, tag: string = 'span'): HTMLElement {
  const element = document.createElement(tag);
  element.className = 'sr-only';
  element.textContent = text;
  return element;
}
