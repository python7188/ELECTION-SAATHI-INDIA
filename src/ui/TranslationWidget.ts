/**
 * Translation Widget — Language switcher for election guidance.
 *
 * Provides a government-style language selector to toggle all civic
 * content between English and Indian regional languages via the
 * Google Cloud Translation API.
 *
 * Uses textContent instead of innerHTML for translated strings to
 * prevent XSS. Falls back gracefully when API is unconfigured.
 *
 * @module ui/TranslationWidget
 */

import { ElectionTranslationService, SUPPORTED_LANGUAGES } from '../services/translation';
import { announce } from '../utils/a11y';

/** Maximum strings per batch request to the Translation API. */
const BATCH_SIZE = 50;

/**
 * Language switcher widget powered by Google Cloud Translation API.
 *
 * Collects translatable text nodes, batches them, and replaces content
 * using safe textContent assignment (not innerHTML).
 */
export class TranslationWidget {
  private readonly service: ElectionTranslationService;
  private currentLang: string = 'en';

  constructor() {
    this.service = new ElectionTranslationService();
    this.render();
    this.attachListeners();
  }

  /**
   * Render the language selector into the header container.
   */
  private render(): void {
    const container = document.getElementById('header-translation-widget');
    if (!container) {
      return;
    }

    const widget = document.createElement('div');
    widget.id = 'translation-widget';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Language selection — powered by Google Cloud Translation API');
    widget.style.cssText = 'display: flex; align-items: center; gap: var(--space-2);';

    const label = document.createElement('label');
    label.htmlFor = 'lang-select';
    label.className = 'sr-only';
    label.textContent = 'Select display language';

    const select = document.createElement('select');
    select.id = 'lang-select';
    select.className = 'lang-select-box';
    select.setAttribute('aria-label', 'Select language for election content');

    // English default
    const defaultOption = document.createElement('option');
    defaultOption.value = 'en';
    defaultOption.textContent = 'ENGLISH';
    select.appendChild(defaultOption);

    // All supported Indian languages
    SUPPORTED_LANGUAGES.forEach(({ code, name, nativeName }) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${nativeName} (${name.toUpperCase()})`;
      select.appendChild(option);
    });

    widget.appendChild(label);
    widget.appendChild(select);
    container.appendChild(widget);
  }

  /**
   * Attach change listener to the language selector.
   */
  private attachListeners(): void {
    const select = document.getElementById('lang-select') as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    select.addEventListener('change', (e) => {
      const lang = (e.currentTarget as HTMLSelectElement).value;
      if (lang) {
        void this.handleTranslation(lang);
      }
    });
  }

  /**
   * Handle a language change event.
   *
   * Collects all translatable elements, batches calls to the
   * Google Cloud Translation API, and safely replaces text content.
   * Never throws — fails silently by preserving original text.
   *
   * @param targetLang - ISO 639-1 target language code.
   */
  private async handleTranslation(targetLang: string): Promise<void> {
    if (this.currentLang === targetLang) {
      return;
    }

    announce(`Translating election content to ${targetLang}…`);

    const nodes = this.collectTranslatableNodes();

    if (targetLang === 'en') {
      // Restore cached English originals
      nodes.forEach((node) => {
        const original = node.dataset['enText'];
        if (original) {
          node.textContent = original;
        }
      });
      this.currentLang = 'en';
      announce('Restored to English.');
      return;
    }

    const texts = nodes.map((node) => node.dataset['enText'] ?? node.textContent ?? '');

    // Process in batches
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      const nodeChunk = nodes.slice(i, i + BATCH_SIZE);

      const translated = await this.service.translateBatch(chunk, targetLang);
      nodeChunk.forEach((node, idx) => {
        if (translated[idx]) {
          node.textContent = translated[idx];
        }
      });
    }

    this.currentLang = targetLang;
    announce('Translation complete.');
  }

  /**
   * Collect all leaf text nodes eligible for translation.
   *
   * Caches original English text in data-en-text attributes
   * to enable lossless round-trip back to English.
   *
   * @returns Array of HTMLElements with translatable text.
   */
  private collectTranslatableNodes(): HTMLElement[] {
    const selectors = 'h1, h2, h3, h4, p, button, label, th, td, li, summary, dt, dd';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors));

    return elements.filter((el) => {
      // Only leaf-like nodes (no nested block elements)
      const hasBlockChildren = Array.from(el.children).some((child) =>
        ['DIV', 'SECTION', 'ARTICLE', 'NAV', 'UL', 'OL'].includes(child.tagName),
      );
      if (hasBlockChildren) {
        return false;
      }

      const text = el.textContent?.trim() ?? '';
      if (text.length < 2) {
        return false;
      }

      // Cache English original once
      if (!el.dataset['enText']) {
        el.dataset['enText'] = text;
      }

      return true;
    });
  }
}
