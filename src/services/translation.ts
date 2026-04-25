/**
 * Google Cloud Translation API Integration
 *
 * Provides translation services for the UI text and chatbot messages.
 *
 * @module services/translation
 */

import { TranslationRequest, TranslationResponse } from '../types/index';
import { store } from '../state/store';
import axios from 'axios';

export class ElectionTranslationService {
  private readonly baseUrl = 'https://translation.googleapis.com/language/translate/v2';
  
  constructor() {
    // Determine if translation is possible
    const apiKey = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY;
    if (apiKey && apiKey.length > 0) {
      store.setState({ isTranslationLoaded: true });
    }
  }

  /**
   * Translate text to a target language.
   *
   * @param text The text to translate.
   * @param targetLanguage Code of the language to translate into (e.g., 'hi' for Hindi).
   * @returns The translated text, or the original text if translation fails.
   */
  public async translateText(text: string, targetLanguage: string): Promise<string> {
    const apiKey = String(import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY || import.meta.env.VITE_GOOGLE_TRANSLATE_KEY || '');
    
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn('[ElectionSaathi] Translation API key is missing. Returning original text.');
      return text;
    }

    try {
      const requestBody: TranslationRequest = {
        q: text,
        target: targetLanguage,
        format: 'html'
      };

      const response = await axios.post<TranslationResponse>(
        `${this.baseUrl}?key=${apiKey}`,
        requestBody
      );

      const data = response.data;
      
      if (data.data?.translations && data.data.translations.length > 0) {
        return data.data.translations[0].translatedText;
      }
      
      return text;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ElectionSaathi] Translation failed:', error);
      return text; // Fallback to original
    }
  }
  /**
   * Translate an array of strings to a target language.
   *
   * @param texts The texts to translate.
   * @param targetLanguage Code of the language to translate into.
   * @returns The translated texts.
   */
  public async translateBatch(texts: string[], targetLanguage: string): Promise<string[]> {
    const apiKey = String(import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY || import.meta.env.VITE_GOOGLE_TRANSLATE_KEY || '');
    
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.warn('[ElectionSaathi] Translation API key is missing. Returning original text.');
      return texts;
    }

    if (texts.length === 0) {return [];}

    try {
      const requestBody: TranslationRequest = {
        q: texts,
        target: targetLanguage,
        format: 'html'
      };

      const response = await axios.post<TranslationResponse>(
        `${this.baseUrl}?key=${apiKey}`,
        requestBody
      );

      const data = response.data;
      
      if (data.data?.translations && data.data.translations.length > 0) {
        return data.data.translations.map(t => t.translatedText);
      }
      
      return texts;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ElectionSaathi] Translation failed:', error);
      throw error;
    }
  }
}
