/**
 * Google Maps Integration — Polling location assistance.
 *
 * Provides location-aware election help: finding polling booths,
 * election offices, voter registration centres, and civic resources.
 *
 * @module services/maps
 */

/// <reference types="@types/google.maps" />

import { PollingLocation, ApiResponse } from '../types/index';
import { sanitizeFull } from '../utils/sanitize';
import { ElectionCache, makeCacheKey } from '../utils/cache';

/** Default map centre — New Delhi (India Gate). */
const INDIA_CENTRE = { lat: 28.6139, lng: 77.2090 };

/** Default zoom level for city-level view. */
const DEFAULT_ZOOM = 12;

/**
 * Google Maps service for election-related location assistance.
 *
 * Manages map rendering, place search, and polling location display.
 * Falls back to a static embed or text-based location info when the
 * Maps JavaScript API is unavailable.
 */
export class ElectionMapsService {
  private readonly apiKey: string;
  private readonly cache: ElectionCache<PollingLocation[]>;
  private mapInstance: google.maps.Map | null;
  private isLoaded: boolean;

  constructor() {
    this.apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_KEY || '');
    this.cache = new ElectionCache<PollingLocation[]>({
      defaultTtlMs: 30 * 60 * 1000, // 30 minutes
      maxEntries: 20,
    });
    this.mapInstance = null;
    this.isLoaded = false;
  }

  /**
   * Check if Google Maps API key is configured.
   *
   * @returns True if an API key is present.
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Load the Google Maps JavaScript API dynamically.
   *
   * @returns True if the API loaded successfully.
   */
  async loadMapsApi(): Promise<boolean> {
    if (this.isLoaded) {
      return true;
    }

    if (!this.isConfigured()) {
      return false;
    }

    return new Promise((resolve) => {
      // Check if already loaded by another script
      if (typeof google !== 'undefined' && google.maps) {
        this.isLoaded = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = (): void => {
        this.isLoaded = true;
        resolve(true);
      };

      script.onerror = (): void => {
        resolve(false);
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialise a Google Map in the specified container element.
   *
   * @param containerId - ID of the HTML element to host the map.
   * @param centre - Optional centre coordinates.
   * @param zoom - Optional zoom level.
   * @returns True if the map was initialised.
   */
  initMap(
    containerId: string,
    centre?: { lat: number; lng: number },
    zoom?: number,
  ): boolean {
    const container = document.getElementById(containerId);
    if (!container || !this.isLoaded) {
      return false;
    }

    this.mapInstance = new google.maps.Map(container, {
      center: centre || INDIA_CENTRE,
      zoom: zoom || DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    return true;
  }

  /**
   * Search for polling-related locations near a given query.
   *
   * @param query - Search query (e.g., "polling booth near Andheri Mumbai").
   * @returns Array of matching polling locations.
   */
  async searchPollingLocations(query: string): Promise<ApiResponse<PollingLocation[]>> {
    const sanitised = sanitizeFull(query, 200);
    const cacheKey = makeCacheKey('maps', sanitised.toLowerCase());

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ok: true, data: cached, error: null, status: 200 };
    }

    // If Maps API is loaded and map exists, use Places API
    if (this.isLoaded && this.mapInstance) {
      return this.searchWithPlacesApi(sanitised, cacheKey);
    }

    // Fallback: return sample locations
    const fallback = this.getFallbackLocations(sanitised);
    return { ok: true, data: fallback, error: null, status: 200 };
  }

  /**
   * Search using the Google Places API.
   *
   * @param query - Sanitised search query.
   * @param cacheKey - Key for caching results.
   * @returns API response with locations.
   */
  private async searchWithPlacesApi(
    query: string,
    cacheKey: string,
  ): Promise<ApiResponse<PollingLocation[]>> {
    if (!this.mapInstance) {
      return { ok: false, data: null, error: 'Map not initialised', status: 0 };
    }

    return new Promise((resolve) => {
      const service = new google.maps.places.PlacesService(this.mapInstance!);

      const request: google.maps.places.TextSearchRequest = {
        query: `${query} election office polling booth India`,
        region: 'in',
      };

      service.textSearch(request, (results, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !results
        ) {
          let errorMsg = 'No locations found. Try a different search.';
          if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            errorMsg = 'Google Maps API Error: Request Denied. Your API key might be invalid or not enabled for the Places API.';
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            errorMsg = 'No polling locations found for this area. Try a broader search.';
          } else if (status !== google.maps.places.PlacesServiceStatus.OK) {
            errorMsg = `Google Maps Error: ${status}`;
          }

          resolve({
            ok: false,
            data: null,
            error: errorMsg,
            status: 0,
          });
          return;
        }

        const locations: PollingLocation[] = results.slice(0, 5).map((place) => ({
          name: place.name || 'Unknown Location',
          address: place.formatted_address || 'Address unavailable',
          latitude: place.geometry?.location?.lat() || 0,
          longitude: place.geometry?.location?.lng() || 0,
        }));

        // Cache results
        this.cache.set(cacheKey, locations);

        // Add markers to map
        locations.forEach((loc) => {
          if (this.mapInstance) {
            new google.maps.Marker({
              position: { lat: loc.latitude, lng: loc.longitude },
              map: this.mapInstance,
              title: loc.name,
            });
          }
        });

        resolve({ ok: true, data: locations, error: null, status: 200 });
      });
    });
  }

  /**
   * Generate a Google Maps embed URL for a location.
   *
   * Used as a lightweight fallback when the full Maps JS API is unavailable.
   *
   * @param query - Location search query.
   * @returns Google Maps embed URL.
   */
  generateMapsEmbedUrl(query: string): string {
    const sanitised = sanitizeFull(query, 200);
    const encoded = encodeURIComponent(`${sanitised} election office India`);

    if (this.apiKey) {
      return `https://www.google.com/maps/embed/v1/search?key=${this.apiKey}&q=${encoded}&region=in`;
    }

    // No-key fallback: link to Google Maps search
    return `https://www.google.com/maps/search/${encoded}`;
  }

  /**
   * Generate a direct Google Maps search link.
   *
   * @param query - Search query.
   * @returns Google Maps URL that opens in a new tab.
   */
  generateMapsLink(query: string): string {
    const sanitised = sanitizeFull(query, 200);
    return `https://www.google.com/maps/search/${encodeURIComponent(sanitised + ' election office India')}`;
  }

  /**
   * Provide fallback sample locations when Maps API is unavailable.
   *
   * @param _query - Search query (used for context).
   * @returns Array of sample polling locations.
   */
  private getFallbackLocations(_query: string): PollingLocation[] {
    return [
      {
        name: 'District Election Office',
        address: 'District Collectorate, your nearest district headquarters',
        latitude: 28.6139,
        longitude: 77.2090,
        constituency: 'Check with your local BLO',
        state: 'Your State',
      },
      {
        name: 'Voter Registration Centre (NVSP)',
        address: 'Visit nvsp.in to find your nearest centre or call 1950',
        latitude: 28.6129,
        longitude: 77.2295,
      },
      {
        name: 'Booth Level Officer (BLO)',
        address: 'Contact your BLO through the Voter Helpline App or call 1950',
        latitude: 28.6353,
        longitude: 77.2250,
      },
    ];
  }

  /**
   * Get the user's current geolocation.
   *
   * @returns Promise resolving to coordinates or null.
   */
  async getUserLocation(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        { timeout: 10000, maximumAge: 300000 },
      );
    });
  }
}
