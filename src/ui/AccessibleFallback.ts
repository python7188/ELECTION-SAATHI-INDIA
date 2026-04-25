/**
 * Accessible Fallback Layer — Full DOM mirror of the 3D scene.
 *
 * Creates an invisible-but-navigable semantic DOM that mirrors
 * every interactive state of the WebGL election journey.
 * Fully keyboard-navigable with ARIA labels, live regions, and focus management.
 *
 * @module ui/AccessibleFallback
 */

import { ELECTION_STAGES, getStagePosition } from '../data/election-stages';
import { ELECTION_TYPES } from '../data/election-types';
import { ELECTION_FAQ } from '../data/faq';
import { getAllTimelineEvents } from '../data/timeline';
import { store } from '../state/store';
import { announce, setActiveNavSection } from '../utils/a11y';
import { escapeHtml } from '../utils/sanitize';
import { JourneyStageId } from '../types/index';

/**
 * Build and manage the accessible fallback layer.
 *
 * Renders all election journey stages, election types, timeline,
 * and FAQ as semantic HTML within the fallback container.
 * Synchronises state with the 3D scene via the global store.
 */
export class AccessibleFallback {
  private container: HTMLElement;

  constructor() {
    const el = document.getElementById('accessible-fallback');
    if (!el) {
      throw new Error('[A11y] #accessible-fallback container not found.');
    }
    this.container = el;
    this.render();
    this.subscribeToState();
    this.renderJourneyStages();
    this.renderElectionTypes();
    this.renderTimeline();
    this.renderFaq();
  }

  /**
   * Render the core structure of the fallback layer.
   */
  private render(): void {
    this.container.innerHTML = `
      <h2 class="sr-only">Election Journey — Accessible Text Interface</h2>
      <p class="sr-only">
        This is the full text alternative to the 3D visual experience.
        All 7 election journey stages, election types, timeline, and FAQ are navigable below.
      </p>
      <nav aria-label="Election journey stage navigation">
        <ul role="tablist" aria-label="Journey stages">
          ${ELECTION_STAGES.map(
            (stage, i) => `
            <li role="presentation">
              <button
                role="tab"
                id="a11y-tab-${stage.id}"
                aria-selected="${i === 0 ? 'true' : 'false'}"
                aria-controls="a11y-panel-${stage.id}"
                tabindex="${i === 0 ? '0' : '-1'}"
                data-stage-id="${stage.id}"
                class="sr-only"
              >
                Stage ${i + 1} of 7: ${escapeHtml(stage.title)}
              </button>
            </li>
          `,
          ).join('')}
        </ul>
      </nav>
      <div id="a11y-stage-panels" aria-live="polite"></div>
    `;

    // Attach keyboard navigation for tab list
    this.setupKeyboardNav();
  }

  /**
   * Render each stage panel with step content.
   */
  private renderJourneyStages(): void {
    const panelsContainer = document.getElementById('journey-stages');
    const contentContainer = document.getElementById('journey-content');
    if (!panelsContainer || !contentContainer) {
      return;
    }

    // Tab buttons
    panelsContainer.innerHTML = ELECTION_STAGES.map((stage, i) => `
      <button
        role="tab"
        id="tab-${stage.id}"
        aria-selected="${i === 0 ? 'true' : 'false'}"
        aria-controls="panel-${stage.id}"
        class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}"
        data-stage-id="${stage.id}"
      >
        <span aria-hidden="true">${stage.icon}</span>
        ${escapeHtml(stage.title)}
      </button>
    `).join('');

    // Initial panel
    this.updateStagePanel(JourneyStageId.ELIGIBILITY);

    // Click handlers
    panelsContainer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-stage-id]');
      if (btn) {
        const stageId = btn.getAttribute('data-stage-id') as JourneyStageId;
        store.goToStage(stageId);
      }
    });
  }

  /**
   * Update the visible stage content panel.
   *
   * @param stageId - Active stage identifier.
   */
  private updateStagePanel(stageId: JourneyStageId): void {
    const content = document.getElementById('journey-content');
    if (!content) {
      return;
    }

    const stage = ELECTION_STAGES.find((s) => s.id === stageId);
    if (!stage) {
      return;
    }

    const pos = getStagePosition(stageId);

    content.innerHTML = `
      <div
        role="tabpanel"
        id="panel-${stage.id}"
        aria-labelledby="tab-${stage.id}"
        class="card"
      >
        <h3>${escapeHtml(stage.title)}</h3>
        <p class="section-description">${escapeHtml(stage.description)}</p>
        <p class="sr-only">Stage ${pos} of 7. ${escapeHtml(stage.ariaLabel)}</p>
        <ol>
          ${stage.steps
            .map(
              (step) => `
            <li style="margin-bottom: var(--space-4);">
              <strong>${escapeHtml(step.title)}</strong>
              <p style="color: var(--text-secondary); margin-top: var(--space-1);">${escapeHtml(step.description)}</p>
              ${
                step.actionLabel && step.actionUrl
                  ? `<a href="${escapeHtml(step.actionUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="margin-top: var(--space-2); display: inline-block;">${escapeHtml(step.actionLabel)} ↗</a>`
                  : ''
              }
            </li>
          `,
            )
            .join('')}
        </ol>
      </div>
    `;

    // Update tab states
    const tabs = document.querySelectorAll('#journey-stages [role="tab"]');
    tabs.forEach((tab) => {
      const isActive = tab.getAttribute('data-stage-id') === stageId;
      tab.setAttribute('aria-selected', String(isActive));
      tab.className = isActive ? 'btn btn-primary' : 'btn btn-secondary';
    });
  }

  /**
   * Render the election types grid.
   */
  private renderElectionTypes(): void {
    const grid = document.getElementById('election-types-grid');
    if (!grid) {
      return;
    }

    grid.innerHTML = ELECTION_TYPES.map(
      (type) => `
      <div class="card" role="listitem" style="margin-bottom: var(--space-4);">
        <h3 style="color: var(--navy);">${escapeHtml(type.name)}</h3>
        <p style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-2);">${escapeHtml(type.fullName)}</p>
        <p>${escapeHtml(type.description)}</p>
        <dl style="margin-top: var(--space-3);">
          <dt style="color: var(--text-secondary);">Governance Level</dt>
          <dd style="margin-bottom: var(--space-2);">${escapeHtml(type.governanceLevel)}</dd>
          <dt style="color: var(--text-secondary);">Frequency</dt>
          <dd style="margin-bottom: var(--space-2);">${escapeHtml(type.frequency)}</dd>
          <dt style="color: var(--text-secondary);">Seats</dt>
          <dd style="margin-bottom: var(--space-2);">${escapeHtml(String(type.totalSeats))}</dd>
          <dt style="color: var(--text-secondary);">Voting Method</dt>
          <dd style="margin-bottom: var(--space-2);">${escapeHtml(type.votingMethod)}</dd>
          <dt style="color: var(--text-secondary);">Conducted By</dt>
          <dd>${escapeHtml(type.conductedBy)}</dd>
        </dl>
        <details style="margin-top: var(--space-3);">
          <summary style="cursor: pointer; color: var(--navy); font-weight: 600;">Key Facts (${type.keyFacts.length})</summary>
          <ul style="margin-top: var(--space-2);">
            ${type.keyFacts.map((fact) => `<li style="margin-bottom: var(--space-1); color: var(--text-secondary);">${escapeHtml(fact)}</li>`).join('')}
          </ul>
        </details>
      </div>
    `,
    ).join('');
  }

  /**
   * Render the election timeline.
   */
  private renderTimeline(): void {
    const timeline = document.getElementById('timeline-content');
    if (!timeline) {
      return;
    }

    const events = getAllTimelineEvents();

    timeline.innerHTML = events
      .map(
        (event) => `
      <div class="card" role="listitem" style="margin-bottom: var(--space-3); border-left: 3px solid ${String(event.priority) === 'critical' ? 'var(--saffron)' : String(event.priority) === 'high' ? 'var(--green-india)' : 'var(--border-subtle)'};">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <h3 style="font-size: var(--text-lg); color: var(--navy);">${escapeHtml(event.title)}</h3>
          <span style="font-size: var(--text-xs); padding: var(--space-1) var(--space-2); border-radius: var(--radius-full); background: ${event.isDeadline ? 'var(--error)' : 'var(--bg-elevated)'}; color: ${event.isDeadline ? 'white' : 'var(--text-secondary)'};">
            ${event.isDeadline ? '⚠ Deadline' : event.priority}
          </span>
        </div>
        <p style="color: var(--text-muted); font-size: var(--text-sm); margin: var(--space-1) 0;">${escapeHtml(event.date)}</p>
        <p style="color: var(--text-secondary);">${escapeHtml(event.description)}</p>
      </div>
    `,
      )
      .join('');
  }

  /**
   * Render the FAQ accordion.
   */
  private renderFaq(): void {
    const faqContainer = document.getElementById('faq-accordion');
    if (!faqContainer) {
      return;
    }

    faqContainer.innerHTML = ELECTION_FAQ.map(
      (faq) => `
      <details class="card" style="margin-bottom: var(--space-3);">
        <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">
          ${escapeHtml(faq.question)}
        </summary>
        <p style="margin-top: var(--space-3); color: var(--text-secondary); line-height: 1.7;">
          ${escapeHtml(faq.answer)}
        </p>
        <p style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">
          Category: ${escapeHtml(faq.category)}
        </p>
      </details>
    `,
    ).join('');
  }

  /**
   * Subscribe to state changes and sync the DOM.
   */
  private subscribeToState(): void {
    store.subscribe((state) => {
      // Update stage panels
      this.updateStagePanel(state.currentStage);

      // Update a11y tab selection
      ELECTION_STAGES.forEach((stage) => {
        const tab = document.getElementById(`a11y-tab-${stage.id}`);
        if (tab) {
          const isActive = stage.id === state.currentStage;
          tab.setAttribute('aria-selected', String(isActive));
          tab.setAttribute('tabindex', isActive ? '0' : '-1');
        }
      });

      // Announce stage change
      const pos = getStagePosition(state.currentStage);
      const stage = ELECTION_STAGES.find((s) => s.id === state.currentStage);
      if (stage) {
        announce(
          `Now viewing stage ${pos} of 7: ${stage.title}. ${stage.subtitle}`,
        );
      }

      // Update nav
      setActiveNavSection(
        state.activeSection || 'election-journey',
      );
    });
  }

  /**
   * Set up keyboard navigation for the tab list.
   * Arrow keys move between tabs; Enter/Space activates.
   */
  private setupKeyboardNav(): void {
    this.container.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement;
      if (target.getAttribute('role') !== 'tab') {
        return;
      }

      const tabs = Array.from(
        this.container.querySelectorAll<HTMLElement>('[role="tab"]'),
      );
      const currentIndex = tabs.indexOf(target);

      let nextIndex = currentIndex;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % tabs.length;
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          event.preventDefault();
          break;
        case 'Home':
          nextIndex = 0;
          event.preventDefault();
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          event.preventDefault();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          {
            const stageId = target.getAttribute('data-stage-id') as JourneyStageId;
            if (stageId) {
              store.goToStage(stageId);
            }
          }
          return;
        default:
          return;
      }

      tabs[nextIndex].focus();
      const stageId = tabs[nextIndex].getAttribute('data-stage-id') as JourneyStageId;
      if (stageId) {
        store.goToStage(stageId);
      }
    });
  }
}
