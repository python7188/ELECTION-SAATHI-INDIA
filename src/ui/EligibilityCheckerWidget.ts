import { validateVoterAge } from '../utils/validate';
import { announce } from '../utils/a11y';

/**
 * Eligibility Checker Widget — Interactive tool for checking voter age.
 *
 * Provides a simple form to validate age against ECI criteria.
 *
 * @module ui/EligibilityCheckerWidget
 */
export class EligibilityCheckerWidget {
  private container: HTMLElement;

  constructor() {
    let el = document.getElementById('eligibility-checker-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'eligibility-checker-container';
      const journey = document.getElementById('election-journey');
      if (journey) {
        const stages = document.getElementById('journey-stages');
        journey.insertBefore(el, stages);
      } else {
        throw new Error('[EligibilityChecker] #election-journey not found.');
      }
    }
    this.container = el;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="card" style="margin-bottom: var(--space-6); border-left: 3px solid var(--green-india);">
        <h3 style="color: var(--navy); margin-bottom: var(--space-2);">
          ✓ Quick Check: Are you eligible to vote?
        </h3>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-4);">
          Enter your age to check your eligibility according to the Election Commission of India.
        </p>
        <form id="eligibility-form" role="search" aria-label="Check voting eligibility" style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
          <label for="age-input" class="sr-only">Enter your age</label>
          <input
            type="number"
            id="age-input"
            min="0"
            max="150"
            placeholder="e.g. 18"
            required
            style="padding: var(--space-2) var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-family: var(--font-sans); width: 120px;"
          />
          <button type="submit" class="btn btn-primary">Check Status</button>
        </form>
        <div id="eligibility-result" style="margin-top: var(--space-3); font-weight: 600;" aria-live="polite"></div>
      </div>
    `;

    this.setupListeners();
  }

  private setupListeners(): void {
    const form = this.container.querySelector('#eligibility-form');
    const input = this.container.querySelector('#age-input') as HTMLInputElement;
    const resultDiv = this.container.querySelector('#eligibility-result') as HTMLElement;

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const age = parseInt(input.value, 10);
      const result = validateVoterAge(age);
      
      if (!result.isValid) {
        resultDiv.style.color = 'var(--error)';
        resultDiv.textContent = result.errors.join(' ');
        announce(result.errors.join(' '), 'assertive');
      } else {
        resultDiv.style.color = age >= 18 ? 'var(--success)' : 'var(--warning)';
        resultDiv.textContent = result.sanitizedValue || '';
        announce(result.sanitizedValue || '');
      }
    });
  }
}
