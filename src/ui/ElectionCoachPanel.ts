/**
 * Election Coach Panel — Conversational UI powered by Gemini AI.
 *
 * Provides an interactive chat interface for election guidance,
 * with tool-call routing to Translation and Maps services.
 *
 * @module ui/ElectionCoachPanel
 */

import { ElectionCoachService } from '../services/gemini';
import { sanitizeFull, escapeHtml } from '../utils/sanitize';
import { validateCoachQuery } from '../utils/validate';
import { announce } from '../utils/a11y';

/**
 * The Election Coach chat panel.
 *
 * Renders a floating panel with message history, input field,
 * and suggested quick-action buttons for common election questions.
 */
export class ElectionCoachPanel {
  private container: HTMLElement;
  private coach: ElectionCoachService;

  constructor() {
    const el = document.getElementById('coach-panel');
    if (!el) {
      throw new Error('[CoachPanel] #coach-panel container not found.');
    }
    this.container = el;
    this.coach = new ElectionCoachService();
    this.render();
  }

  /**
   * Render the coach panel UI.
   */
  private render(): void {
    this.container.innerHTML = `
      <div id="coach-chat" class="card" style="max-width: 640px; margin: 0 auto;">
        <div id="coach-messages" role="log" aria-label="Election Coach conversation" aria-live="polite" style="max-height: 400px; overflow-y: auto; margin-bottom: var(--space-4);">
          <div class="coach-message coach-assistant" style="padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); margin-bottom: var(--space-3);">
            <p style="color: var(--navy); font-weight: 600; margin-bottom: var(--space-1);">🏛️ Official Helpdesk</p>
            <p style="color: var(--text-secondary);">Namaste! I'm your Election Assistant. Ask me anything about Indian elections — eligibility, registration, EVMs, polling booths, or any election type. How can I help you today?</p>
          </div>
        </div>

        <div id="coach-suggestions" style="display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3);">
          <button class="btn btn-secondary coach-suggestion" data-query="Am I eligible to vote?">Am I eligible?</button>
          <button class="btn btn-secondary coach-suggestion" data-query="How do I register to vote online?">Register to vote</button>
          <button class="btn btn-secondary coach-suggestion" data-query="Where is my polling booth?">Find my booth</button>
          <button class="btn btn-secondary coach-suggestion" data-query="What is NOTA?">About NOTA</button>
          <button class="btn btn-secondary coach-suggestion" data-query="Tell me about Lok Sabha elections">Lok Sabha</button>
          <button class="btn btn-secondary coach-suggestion" data-query="How do panchayat elections work?">Panchayat</button>
        </div>

        <form id="coach-form" role="search" aria-label="Ask the Election Coach a question">
          <div style="display: flex; gap: var(--space-2);">
            <label for="coach-input" class="sr-only">Type your election question</label>
            <input
              id="coach-input"
              type="text"
              placeholder="Ask about Indian elections…"
              autocomplete="off"
              maxlength="2000"
              style="flex: 1; padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-base);"
            />
            <button type="submit" class="btn btn-primary" id="coach-send" aria-label="Send question to Election Coach">
              Send
            </button>
          </div>
        </form>

        <p style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">
          Powered by Google Gemini AI${this.coach.isConfigured() ? '' : ' (offline mode — using built-in knowledge)'}
        </p>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Set up form submission and suggestion click handlers.
   */
  private setupEventListeners(): void {
    const form = document.getElementById('coach-form') as HTMLFormElement;
    const input = document.getElementById('coach-input') as HTMLInputElement;

    // Form submit
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (query) {
        void this.handleQuery(query);
        input.value = '';
      }
    });

    // Suggestion buttons
    this.container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.coach-suggestion');
      if (btn) {
        const query = btn.getAttribute('data-query') || '';
        if (query) {
          void this.handleQuery(query);
        }
      }
    });
  }

  /**
   * Handle a user query: validate, display, send to coach, display response.
   *
   * @param query - Raw user question.
   */
  private async handleQuery(query: string): Promise<void> {
    const validation = validateCoachQuery(query);
    if (!validation.isValid) {
      announce(validation.errors.join('. '), 'assertive');
      return;
    }

    const sanitised = validation.sanitizedValue || sanitizeFull(query);

    // Show user message
    this.appendMessage('user', sanitised);

    // Show loading state
    const loadingId = this.appendMessage('assistant', '🤔 Thinking about your question...');

    // Get response
    const response = await this.coach.chat(sanitised);

    // Replace loading with actual response
    this.replaceMessage(loadingId, response.content);

    // Announce response
    announce(`Election Coach: ${response.content.slice(0, 200)}`);
  }

  /**
   * Append a message to the chat log.
   *
   * @param role - Message role.
   * @param content - Message content.
   * @returns The message element's ID.
   */
  private appendMessage(role: 'user' | 'assistant', content: string): string {
    const messages = document.getElementById('coach-messages');
    if (!messages) {
      return '';
    }

    const id = `msg-${Date.now()}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `coach-message coach-${role}`;
    div.style.cssText = `
      padding: var(--space-3);
      background: ${role === 'user' ? 'rgba(0, 0, 128, 0.05)' : 'var(--bg-elevated)'};
      border-radius: var(--radius-md);
      margin-bottom: var(--space-3);
      ${role === 'user' ? 'border-left: 3px solid var(--navy);' : ''}
    `;

    const label = role === 'user' ? 'You' : '🏛️ Official Helpdesk';
    div.innerHTML = `
      <p style="color: var(--navy); font-weight: 600; margin-bottom: var(--space-1);">${label}</p>
      <p style="color: var(--text-secondary); white-space: pre-wrap;">${escapeHtml(content)}</p>
    `;

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    return id;
  }

  /**
   * Replace a message's content (used for loading → response transition).
   *
   * @param id - Message element ID.
   * @param content - New content.
   */
  private replaceMessage(id: string, content: string): void {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    const p = el.querySelector('p:last-child');
    if (p) {
      p.innerHTML = escapeHtml(content);
    }
  }
}
