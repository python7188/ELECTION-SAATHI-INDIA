/**
 * Google Cloud Analytics — Firestore + Natural Language API Integration.
 *
 * Logs anonymised voter queries to Google Cloud Firestore for aggregated
 * analysis and uses the Google Cloud Natural Language API to classify
 * query intent and extract election-related entities.
 *
 * Data stored is never personally identifiable — only query category,
 * intent, and timestamp are retained.
 *
 * @module services/analytics
 */

import { SafeApiClient } from './api-client';
import { sanitizeFull } from '../utils/sanitize';

/* ---- Types ---- */

/** Categories of voter intent detected by Natural Language API. */
export type QueryIntent =
  | 'eligibility'
  | 'registration'
  | 'polling_location'
  | 'election_type'
  | 'evm_vvpat'
  | 'candidate_info'
  | 'timeline'
  | 'general';

/** Anonymised analytics event stored in Firestore. */
export interface AnalyticsEvent {
  readonly sessionId: string;
  readonly queryCategory: QueryIntent;
  readonly languageCode: string;
  readonly timestamp: string;
  readonly entities: readonly string[];
  readonly sentiment: 'positive' | 'neutral' | 'negative';
}

/** Natural Language API entity result. */
interface NLEntity {
  name: string;
  type: string;
  salience: number;
}

/** Natural Language API sentiment result. */
interface NLSentiment {
  score: number;
  magnitude: number;
}

/** Natural Language API response structure. */
interface NLApiResponse {
  entities?: NLEntity[];
  documentSentiment?: NLSentiment;
  language?: string;
}

/** Firestore document write response. */
interface FirestoreWriteResponse {
  name?: string;
  fields?: Record<string, unknown>;
}

/* ---- Constants ---- */

/** Firestore REST API base for election-saathi-india project. */
const FIRESTORE_BASE =
  'https://firestore.googleapis.com/v1/projects/election-saathi-india/databases/(default)/documents';

/** Natural Language API endpoint. */
const NL_API_BASE = 'https://language.googleapis.com/v1';

/* ---- Intent Classification Map ---- */

/**
 * Keyword-to-intent map for local pre-classification.
 * Replaces a complex if-else chain to stay within complexity limits.
 */
const INTENT_MAP: readonly { readonly keywords: readonly string[]; readonly intent: QueryIntent }[] =
  [
    { keywords: ['eligib', 'can i vote', 'age'], intent: 'eligibility' },
    { keywords: ['register', 'enrol', 'form 6'], intent: 'registration' },
    { keywords: ['booth', 'polling', 'where'], intent: 'polling_location' },
    { keywords: ['evm', 'vvpat', 'machine'], intent: 'evm_vvpat' },
    { keywords: ['lok sabha', 'rajya', 'panchayat', 'municipal'], intent: 'election_type' },
    { keywords: ['candidate', 'party', 'mp'], intent: 'candidate_info' },
    { keywords: ['date', 'schedule', 'deadline'], intent: 'timeline' },
  ] as const;

/* ---- Service ---- */

/**
 * Election Analytics Service.
 *
 * Integrates Google Cloud Natural Language API for query intent classification
 * and Google Cloud Firestore for anonymised event logging. Both services
 * degrade gracefully when API keys are absent.
 */
export class ElectionAnalyticsService {
  private readonly nlClient: SafeApiClient;
  private readonly firestoreClient: SafeApiClient;
  private readonly apiKey: string;
  private readonly sessionId: string;

  constructor() {
    this.apiKey = String(
      import.meta.env.VITE_GOOGLE_CLOUD_API_KEY ||
        import.meta.env.VITE_GEMINI_API_KEY ||
        import.meta.env.VITE_GEMINI_KEY ||
        '',
    );

    this.sessionId = this.generateSessionId();

    this.nlClient = new SafeApiClient({
      baseUrl: NL_API_BASE,
      timeoutMs: 10000,
      retries: 0,
    });

    this.firestoreClient = new SafeApiClient({
      baseUrl: FIRESTORE_BASE,
      timeoutMs: 8000,
      retries: 0,
    });
  }

  /**
   * Track a voter query using Natural Language API + Firestore.
   *
   * Classifies the query intent and logs an anonymised event.
   * Fails silently — never blocks the user experience.
   *
   * @param query - Raw voter query text.
   * @returns Void — analytics failures are swallowed.
   */
  async trackQuery(query: string): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    const sanitised = sanitizeFull(query, 500);

    try {
      const [intent, nlResult] = await Promise.all([
        Promise.resolve(this.classifyIntent(sanitised)),
        this.analyseWithNaturalLanguage(sanitised),
      ]);

      const event: AnalyticsEvent = {
        sessionId: this.sessionId,
        queryCategory: intent,
        languageCode: nlResult.language ?? 'en',
        timestamp: new Date().toISOString(),
        entities: nlResult.entities?.slice(0, 5).map((e) => e.type) ?? [],
        sentiment: this.normaliseSentiment(nlResult.documentSentiment),
      };

      await this.logToFirestore(event);
    } catch {
      // Fail silently — analytics must never interrupt the voter experience
    }
  }

  /**
   * Analyse text using Google Cloud Natural Language API.
   *
   * Extracts entities and detects sentiment for query understanding.
   *
   * @param text - Text to analyse.
   * @returns Natural Language API result with entities and sentiment.
   */
  private async analyseWithNaturalLanguage(text: string): Promise<NLApiResponse> {
    const endpoint = `/documents:analyzeEntities?key=${this.apiKey}`;

    const body = {
      document: {
        type: 'PLAIN_TEXT',
        content: text,
        language: 'en',
      },
      encodingType: 'UTF8',
    };

    const response = await this.nlClient.post<NLApiResponse>(endpoint, body);

    if (response.ok && response.data) {
      return response.data;
    }

    return {};
  }

  /**
   * Write an analytics event to Google Cloud Firestore.
   *
   * Uses the Firestore REST API to avoid SDK overhead.
   *
   * @param event - Anonymised analytics event.
   */
  private async logToFirestore(event: AnalyticsEvent): Promise<void> {
    const collection = 'voter_queries';
    const endpoint = `/${collection}?key=${this.apiKey}`;

    const firestoreDoc = {
      fields: {
        sessionId: { stringValue: event.sessionId },
        queryCategory: { stringValue: event.queryCategory },
        languageCode: { stringValue: event.languageCode },
        timestamp: { timestampValue: event.timestamp },
        sentiment: { stringValue: event.sentiment },
        entityTypes: {
          arrayValue: {
            values: event.entities.map((e) => ({ stringValue: e })),
          },
        },
      },
    };

    await this.firestoreClient.post<FirestoreWriteResponse>(endpoint, firestoreDoc);
  }

  /**
   * Classify a voter query into an intent category using keyword matching.
   *
   * Uses a data-driven lookup table to avoid high cyclomatic complexity.
   * Acts as a fast local pre-classifier before the NL API call.
   *
   * @param query - Lowercase sanitised query.
   * @returns Matched intent category.
   */
  private classifyIntent(query: string): QueryIntent {
    const lower = query.toLowerCase();

    const match = INTENT_MAP.find((entry) =>
      entry.keywords.some((kw) => lower.includes(kw)),
    );

    return match?.intent ?? 'general';
  }

  /**
   * Normalise a Natural Language API sentiment score to a readable label.
   *
   * @param sentiment - Raw NL API sentiment object.
   * @returns Human-readable sentiment label.
   */
  private normaliseSentiment(
    sentiment: NLSentiment | undefined,
  ): 'positive' | 'neutral' | 'negative' {
    if (!sentiment) {
      return 'neutral';
    }

    if (sentiment.score > 0.15) {
      return 'positive';
    }
    if (sentiment.score < -0.15) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * Generate a unique, anonymous session identifier.
   *
   * Uses crypto.randomUUID() for standards-compliant uniqueness.
   * Falls back to a timestamp-based ID if the API is unavailable.
   *
   * @returns Anonymous session ID string.
   */
  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Check if analytics services are configured.
   *
   * @returns True if an API key is present.
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }
}
