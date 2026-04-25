/**
 * Translation Widget
 *
 * Provides a language switcher to toggle the UI between English and other Indian languages.
 *
 * @module ui/TranslationWidget
 */

import { ElectionTranslationService } from '../services/translation';
import { announce } from '../utils/a11y';
import { store } from '../state/store';

export class TranslationWidget {
  private translationService: ElectionTranslationService;
  private currentLang: string = 'en';

  constructor() {
    this.translationService = new ElectionTranslationService();
    this.render();
    this.attachListeners();
  }

  private render(): void {
    const headerContainer = document.getElementById('header-translation-widget');
    if (!headerContainer) return;

    const widget = document.createElement('div');
    widget.className = 'translation-widget';
    widget.id = 'translation-widget';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Language selection powered by Google Cloud Translation');
    widget.style.display = 'flex';
    widget.style.alignItems = 'center';
    widget.style.gap = 'var(--space-2)';

    widget.innerHTML = `
      <select id="lang-select" class="lang-select-box" aria-label="Select language">
        <option value="en">ENGLISH</option>
        <option value="hi">हिंदी (HINDI)</option>
        <option value="te">తెలుగు (TELUGU)</option>
        <option value="ta">தமிழ் (TAMIL)</option>
      </select>
    `;

    headerContainer.appendChild(widget);
  }

  private attachListeners(): void {
    const select = document.getElementById('lang-select') as HTMLSelectElement;
    if (!select) return;

    select.addEventListener('change', async (e) => {
      const target = e.currentTarget as HTMLSelectElement;
      const lang = target.value;
      if (!lang) return;
      
      await this.handleTranslation(lang);
    });
  }

  private async handleTranslation(targetLang: string): Promise<void> {
    if (!store.getState().isTranslationLoaded) {
      announce('Translation API key is not configured. Falling back to English.');
      console.warn('[ElectionSaathi] Translation API key missing.');
      return;
    }

    if (this.currentLang === targetLang) return;
    
    // UI update
    announce(`Translating page to ${targetLang}...`);

    // Target elements to translate
    const elements = Array.from(document.querySelectorAll('h1, h2, h3, p, button, a.nav-link, span'));
    const textNodes: HTMLElement[] = [];
    const stringsToTranslate: string[] = [];

    // Collect elements with actual text
    elements.forEach(el => {
      const htmlEl = el as HTMLElement;
      // Allow elements with no children, or elements where ALL children are <br> tags
      const hasOnlyTextOrBr = Array.from(htmlEl.children).every(child => child.tagName === 'BR');
      
      if (hasOnlyTextOrBr && htmlEl.innerText && htmlEl.innerText.trim().length > 0) {
        if (!htmlEl.hasAttribute('data-en-text')) {
          htmlEl.setAttribute('data-en-text', htmlEl.innerHTML);
        }
        textNodes.push(htmlEl);
        stringsToTranslate.push(htmlEl.getAttribute('data-en-text')!);
      }
    });

    if (targetLang === 'en') {
      textNodes.forEach((el) => {
        el.innerHTML = el.getAttribute('data-en-text') || el.innerHTML;
      });
    } else {
      // Chunk requests into max 100 strings per batch
      const BATCH_SIZE = 50;
      for (let i = 0; i < stringsToTranslate.length; i += BATCH_SIZE) {
        const chunk = stringsToTranslate.slice(i, i + BATCH_SIZE);
        const nodeChunk = textNodes.slice(i, i + BATCH_SIZE);
        
        try {
          const translated = await this.translationService.translateBatch(chunk, targetLang);
          
          nodeChunk.forEach((el, index) => {
            if (translated[index]) {
              el.innerHTML = translated[index];
            }
          });
        } catch (e) {
          console.error('[Translation] Batch failed', e);
          alert('Error: Translation failed. Your Google Cloud Translation API Key is invalid or not enabled. Check the developer console for details.');
          
          // Reset select box back to English to indicate failure
          const select = document.getElementById('lang-select') as HTMLSelectElement;
          if (select) select.value = 'en';
          this.currentLang = 'en';
          
          break; // Stop translating further chunks to avoid spam
        }
      }
    }

    this.currentLang = targetLang;
    announce(`Translation complete.`);
  }
}
