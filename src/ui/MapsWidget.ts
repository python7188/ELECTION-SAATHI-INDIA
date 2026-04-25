/**
 * Maps Widget — Polling location finder UI.
 *
 * Provides Google Maps integration for finding polling booths,
 * election offices, and voter registration centres.
 *
 * @module ui/MapsWidget
 */

import { ElectionMapsService } from '../services/maps';
import { escapeHtml, sanitizeFull } from '../utils/sanitize';
import { announce } from '../utils/a11y';

/**
 * Maps-based polling location finder widget.
 *
 * Shows a search form and either a Google Maps embed or
 * a list of fallback location suggestions.
 */
export class MapsWidget {
  private maps: ElectionMapsService;

  constructor() {
    this.maps = new ElectionMapsService();
    this.render();
    void this.initializeMap();
  }

  private async initializeMap(): Promise<void> {
    const loaded = await this.maps.loadMapsApi();
    if (loaded) {
      const container = document.getElementById('maps-embed-container');
      if (container) {
        container.style.display = 'block';
        container.style.height = '400px';
        container.innerHTML = ''; // clear comment
        this.maps.initMap('maps-embed-container');
      }
    }
  }

  /**
   * Render the maps widget within the coach section.
   */
  private render(): void {
    const coach = document.getElementById('coach-panel');
    if (!coach) {
      return;
    }

    const widget = document.createElement('div');
    widget.id = 'maps-widget';
    widget.className = 'card';
    widget.style.cssText = 'max-width: 640px; margin: var(--space-4) auto 0;';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Find polling locations using Google Maps');

    widget.innerHTML = `
      <h3 style="color: var(--navy); margin-bottom: var(--space-3);">
        📍 Find Election Offices & Polling Booths
        <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 400;">— powered by Google Maps</span>
      </h3>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
        Search for your nearest polling booth, district election office, or voter registration centre.
      </p>

      <form id="maps-search-form" role="search" aria-label="Search for polling locations">
        <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-3);">
          <label for="maps-search-input" class="sr-only">Enter your area, city, or PIN code</label>
          <input
            id="maps-search-input"
            type="text"
            placeholder="Enter area, city, or PIN code…"
            autocomplete="off"
            maxlength="200"
            style="flex: 1; padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-sans);"
          />
          <button type="submit" class="btn btn-primary" id="maps-search-btn" aria-label="Search for polling locations">
            Search
          </button>
        </div>
      </form>

      <div id="maps-results" role="region" aria-label="Polling location search results" aria-live="polite">
        <div style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
          <p>Enter your area or PIN code to find nearby election resources.</p>
          <p style="font-size: var(--text-xs); margin-top: var(--space-2);">
            <a href="https://electoralsearch.eci.gov.in/" target="_blank" rel="noopener noreferrer" style="color: var(--navy); font-weight: 600; text-decoration: underline;">ECI Electoral Search</a>
            or call Voter Helpline: <strong>1950</strong>
          </p>
        </div>
      </div>

      <div id="maps-embed-container" style="margin-top: var(--space-3); border-radius: var(--radius-md); overflow: hidden; display: none;">
        <!-- Maps embed loads here -->
      </div>
    `;

    coach.appendChild(widget);
    this.setupEventListeners(widget);
  }

  /**
   * Set up search form handlers.
   *
   * @param widget - Widget container.
   */
  private setupEventListeners(widget: HTMLElement): void {
    const form = widget.querySelector('#maps-search-form') as HTMLFormElement;
    const input = widget.querySelector('#maps-search-input') as HTMLInputElement;

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (query) {
        void this.handleSearch(query);
      }
    });
  }

  /**
   * Handle a location search.
   *
   * @param query - Search query.
   */
  // eslint-disable-next-line max-lines-per-function
  private async handleSearch(query: string): Promise<void> {
    const sanitised = sanitizeFull(query, 200);
    const results = document.getElementById('maps-results');
    const embedContainer = document.getElementById('maps-embed-container');

    if (!results) {
      return;
    }

    // Show loading
    results.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: var(--space-4);">🔍 Searching for polling locations...</p>';
    announce('Searching for polling locations near ' + sanitised);

    // Search
    const response = await this.maps.searchPollingLocations(sanitised);

    if (response.ok && response.data) {
      results.innerHTML = `
        <p style="font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-3);">
          Found ${response.data.length} result(s) for "${escapeHtml(sanitised)}"
        </p>
        ${response.data
          .map(
            (loc) => `
          <div style="padding: var(--space-3); border-bottom: 1px solid var(--border-subtle);">
            <p style="font-weight: 600;">${escapeHtml(loc.name)}</p>
            <p style="font-size: var(--text-sm); color: var(--text-secondary);">${escapeHtml(loc.address)}</p>
            ${loc.constituency ? `<p style="font-size: var(--text-xs); color: var(--text-muted);">Constituency: ${escapeHtml(loc.constituency)}</p>` : ''}
            <a
              href="${this.maps.generateMapsLink(loc.name + ' ' + loc.address)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-secondary"
              style="margin-top: var(--space-2); display: inline-block; font-size: var(--text-xs);"
              aria-label="Open ${escapeHtml(loc.name)} in Google Maps"
            >
              Open in Google Maps ↗
            </a>
          </div>
        `,
          )
          .join('')}
      `;

      // Show embed if API key available and native map isn't loaded
      if (embedContainer && this.maps.isConfigured()) {
        const isNativeMap = embedContainer.querySelector('.gm-style');
        
        if (!isNativeMap) {
          const embedUrl = this.maps.generateMapsEmbedUrl(sanitised);
          embedContainer.innerHTML = `
            <iframe
              src="${escapeHtml(embedUrl)}"
              width="100%"
              height="300"
              style="border: 0; border-radius: var(--radius-md);"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              title="Google Maps showing polling locations near ${escapeHtml(sanitised)}"
            ></iframe>
          `;
          embedContainer.style.display = 'block';
        } else {
          embedContainer.style.display = 'block';
        }
      }

      announce(`Found ${response.data.length} polling locations.`);
    } else {
      results.innerHTML = `
        <div style="text-align: center; padding: var(--space-4); color: var(--text-muted);">
          <p style="color: #ef4444; margin-bottom: var(--space-2); font-weight: 500;">
            ⚠️ ${escapeHtml(response.error || 'Failed to find polling locations.')}
          </p>
          <p style="font-size: var(--text-sm);">
            You can also try the official <a href="https://electoralsearch.eci.gov.in/" target="_blank" rel="noopener noreferrer" style="color: var(--navy); font-weight: 600; text-decoration: underline;">ECI Electoral Search</a>.
          </p>
        </div>
      `;
    }
  }
}
