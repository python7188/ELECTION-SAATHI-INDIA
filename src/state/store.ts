/**
 * Application State Store — Simple reactive state management.
 *
 * Provides a lightweight pub/sub store for the entire application.
 * No external dependencies — uses the observer pattern.
 *
 * @module state/store
 */

import {
  AppState,
  StateSubscriber,
  JourneyStageId,
  ElectionCategory,
} from '../types/index';
import { prefersReducedMotion } from '../utils/a11y';

/**
 * Initial application state with safe defaults.
 * Sets the first journey stage as active and detects motion preference.
 */
function createInitialState(): AppState {
  return {
    currentStage: JourneyStageId.ELIGIBILITY,
    selectedElectionType: null,
    isCoachOpen: false,
    coachMessages: [],
    isTranslationLoaded: false,
    isMapsLoaded: false,
    isReducedMotion: prefersReducedMotion(),
    is3DEnabled: true,
    activeSection: 'election-journey',
  };
}

/**
 * Reactive state store for Election Saathi India.
 *
 * Supports partial updates, subscriptions, and state snapshots.
 * All mutations are synchronous and immediately notify subscribers.
 */
export class ElectionStore {
  private state: AppState;
  private readonly subscribers: Set<StateSubscriber>;

  constructor() {
    this.state = createInitialState();
    this.subscribers = new Set();
  }

  /**
   * Get a read-only snapshot of the current state.
   *
   * @returns Frozen copy of the current state.
   */
  getState(): Readonly<AppState> {
    return { ...this.state };
  }

  /**
   * Update state with a partial change.
   *
   * Merges the update into the current state and notifies all subscribers.
   *
   * @param update - Partial state to merge.
   */
  setState(update: Partial<AppState>): void {
    this.state = { ...this.state, ...update };
    this.notify();
  }

  /**
   * Subscribe to state changes.
   *
   * @param subscriber - Callback invoked on every state change.
   * @returns Unsubscribe function.
   */
  subscribe(subscriber: StateSubscriber): () => void {
    this.subscribers.add(subscriber);
    // Immediately call with current state
    subscriber(this.getState());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Navigate to a specific journey stage.
   *
   * @param stageId - Target stage identifier.
   */
  goToStage(stageId: JourneyStageId): void {
    this.setState({ currentStage: stageId });
  }

  /**
   * Select an election type for detailed viewing.
   *
   * @param category - Election category or null to deselect.
   */
  selectElectionType(category: ElectionCategory | null): void {
    this.setState({ selectedElectionType: category });
  }

  /**
   * Toggle the Election Coach panel.
   */
  toggleCoach(): void {
    this.setState({ isCoachOpen: !this.state.isCoachOpen });
  }

  /**
   * Reset state to initial defaults.
   */
  reset(): void {
    this.state = createInitialState();
    this.notify();
  }

  /**
   * Notify all subscribers of the current state.
   */
  private notify(): void {
    const snapshot = this.getState();
    this.subscribers.forEach((subscriber) => {
      subscriber(snapshot);
    });
  }
}

/** Singleton store instance for the application. */
export const store = new ElectionStore();
