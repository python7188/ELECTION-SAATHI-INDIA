/**
 * Election Saathi India — Core Type Definitions
 *
 * Centralised TypeScript types for the entire application.
 * Covers election stages, types, timelines, Google service contracts,
 * and accessibility state.
 *
 * @module types
 */

/* ============================================================
   ELECTION TYPES — All Indian Election Categories
   ============================================================ */

/** Every category of election conducted in India. */
export enum ElectionCategory {
  LOK_SABHA = 'LOK_SABHA',
  RAJYA_SABHA = 'RAJYA_SABHA',
  STATE_ASSEMBLY = 'STATE_ASSEMBLY',
  PANCHAYAT = 'PANCHAYAT',
  MUNICIPAL = 'MUNICIPAL',
  BY_ELECTION = 'BY_ELECTION',
}

/** Governance level the election corresponds to. */
export enum GovernanceLevel {
  NATIONAL = 'NATIONAL',
  STATE = 'STATE',
  LOCAL = 'LOCAL',
}

/** Comprehensive descriptor for an Indian election type. */
export interface ElectionType {
  readonly id: ElectionCategory;
  readonly name: string;
  readonly fullName: string;
  readonly governanceLevel: GovernanceLevel;
  readonly description: string;
  readonly frequency: string;
  readonly totalSeats: number | string;
  readonly votingMethod: string;
  readonly conductedBy: string;
  readonly ageRequirement: number;
  readonly keyFacts: readonly string[];
}

/* ============================================================
   ELECTION JOURNEY STAGES
   ============================================================ */

/** Identifiers for each step in the voter journey. */
export enum JourneyStageId {
  ELIGIBILITY = 'eligibility',
  REGISTRATION = 'registration',
  CANDIDATES = 'candidates',
  VOTING_METHODS = 'voting_methods',
  TIMELINE = 'timeline',
  POLLING_DAY = 'polling_day',
  POST_VOTE = 'post_vote',
}

/** A single action item within a journey stage. */
export interface StageStep {
  readonly order: number;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionUrl?: string;
}

/** A complete journey stage with steps and visual metadata. */
export interface JourneyStage {
  readonly id: JourneyStageId;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly icon: string;
  readonly steps: readonly StageStep[];
  readonly color: string;
  readonly ariaLabel: string;
}

/* ============================================================
   TIMELINE & DATES
   ============================================================ */

/** Priority level for a timeline event. */
export enum TimelinePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/** A single election-related date or deadline. */
export interface TimelineEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly electionCategory: ElectionCategory;
  readonly priority: TimelinePriority;
  readonly isDeadline: boolean;
  readonly reminderText: string;
}

/* ============================================================
   FAQ
   ============================================================ */

/** A frequently asked election question. */
export interface FAQItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
  readonly relatedStageId?: JourneyStageId;
}

/* ============================================================
   GOOGLE SERVICE CONTRACTS
   ============================================================ */

/** Configuration for Google API clients. */
export interface GoogleServiceConfig {
  readonly apiKey: string;
  readonly projectId?: string;
  readonly clientId?: string;
  readonly model?: string;
}

/** Gemini tool-call function declaration. */
export interface GeminiToolDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: 'object';
    readonly properties: Record<string, GeminiParameterSchema>;
    readonly required: readonly string[];
  };
}

/** Schema for a single Gemini tool parameter. */
export interface GeminiParameterSchema {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description: string;
  readonly enum?: readonly string[];
}

/** A message in the Election Coach conversation. */
export interface CoachMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: number;
  readonly toolCalls?: readonly ToolCallResult[];
}

/** Result from a Gemini tool call. */
export interface ToolCallResult {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
  readonly status: 'success' | 'error';
}

/** Google Cloud Translation request. */
export interface TranslationRequest {
  readonly q: string | string[];
  readonly target: string;
  readonly source?: string;
  readonly format?: 'text' | 'html';
}

/** Google Cloud Translation response. */
export interface TranslationResponse {
  readonly data: {
    readonly translations: {
      readonly translatedText: string;
      readonly detectedSourceLanguage?: string;
    }[];
  };
}

/** Google Maps polling location result. */
export interface PollingLocation {
  readonly name: string;
  readonly address: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly distance?: string;
  readonly constituency?: string;
  readonly state?: string;
}

/* ============================================================
   APPLICATION STATE
   ============================================================ */

/** Current stage the user is viewing in the journey. */
export interface AppState {
  currentStage: JourneyStageId;
  selectedElectionType: ElectionCategory | null;
  isCoachOpen: boolean;
  coachMessages: CoachMessage[];
  isTranslationLoaded: boolean;
  isMapsLoaded: boolean;
  isReducedMotion: boolean;
  is3DEnabled: boolean;
  activeSection: string;
}

/** Callback type for state change subscribers. */
export type StateSubscriber = (state: Readonly<AppState>) => void;

/* ============================================================
   ACCESSIBILITY STATE
   ============================================================ */

/** State of the accessible DOM fallback layer. */
export interface A11yFallbackState {
  readonly activeStageId: JourneyStageId;
  readonly expandedPanels: readonly string[];
  readonly focusedElementId: string | null;
  readonly announcementQueue: readonly string[];
}

/* ============================================================
   API CLIENT
   ============================================================ */

/** Configuration for the safe fetch wrapper. */
export interface FetchConfig {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly headers?: Record<string, string>;
  readonly retries?: number;
}

/** Standardised API response wrapper. */
export interface ApiResponse<T> {
  readonly ok: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly status: number;
}

/* ============================================================
   CACHE
   ============================================================ */

/** A cached entry with TTL metadata. */
export interface CacheEntry<T> {
  readonly value: T;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/** Cache configuration. */
export interface CacheConfig {
  readonly defaultTtlMs: number;
  readonly maxEntries: number;
}

/* ============================================================
   VALIDATION
   ============================================================ */

/** Result of an input validation check. */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly sanitizedValue?: string;
}
