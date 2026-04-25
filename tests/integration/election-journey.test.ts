/**
 * Integration tests — Election journey user flows.
 *
 * Tests end-to-end flows: stage navigation, tool routing,
 * accessible fallback synchronisation, and state management.
 *
 * @module tests/integration/election-journey.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ElectionStore } from '../../src/state/store';
import { ELECTION_STAGES, getNextStage } from '../../src/data/election-stages';
import { ELECTION_TYPES } from '../../src/data/election-types';
import { ELECTION_FAQ, searchFaq } from '../../src/data/faq';
import { getAllTimelineEvents, getDeadlineEvents } from '../../src/data/timeline';
import { ElectionCoachService, ELECTION_TOOLS } from '../../src/services/gemini';
import { ElectionMapsService } from '../../src/services/maps';
import {
  JourneyStageId,
  ElectionCategory,
} from '../../src/types/index';

describe('Election Journey — Full User Flow', () => {
  let appStore: ElectionStore;

  beforeEach(() => {
    appStore = new ElectionStore();
  });

  it('starts at the Eligibility stage', () => {
    const state = appStore.getState();
    expect(state.currentStage).toBe(JourneyStageId.ELIGIBILITY);
  });

  it('navigates through all 7 stages sequentially', () => {
    const stages = Object.values(JourneyStageId);
    stages.forEach((stageId) => {
      appStore.goToStage(stageId);
      expect(appStore.getState().currentStage).toBe(stageId);
    });
  });

  it('stage navigation matches data layer ordering', () => {
    let current = ELECTION_STAGES[0];
    for (let i = 0; i < ELECTION_STAGES.length - 1; i++) {
      const next = getNextStage(current.id);
      expect(next).toBeDefined();
      expect(next!.id).toBe(ELECTION_STAGES[i + 1].id);
      current = next!;
    }
  });

  it('every journey stage has actionable content', () => {
    ELECTION_STAGES.forEach((stage) => {
      expect(stage.steps.length).toBeGreaterThanOrEqual(4);
      stage.steps.forEach((step) => {
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.description.length).toBeGreaterThan(20);
      });
    });
  });

  it('every election type maps to a valid governance level', () => {
    ELECTION_TYPES.forEach((type) => {
      expect(['NATIONAL', 'STATE', 'LOCAL']).toContain(type.governanceLevel);
    });
  });

  it('covers all 6 Indian election types', () => {
    const categories = ELECTION_TYPES.map((t) => t.id);
    expect(categories).toContain(ElectionCategory.LOK_SABHA);
    expect(categories).toContain(ElectionCategory.RAJYA_SABHA);
    expect(categories).toContain(ElectionCategory.STATE_ASSEMBLY);
    expect(categories).toContain(ElectionCategory.PANCHAYAT);
    expect(categories).toContain(ElectionCategory.MUNICIPAL);
    expect(categories).toContain(ElectionCategory.BY_ELECTION);
  });
});

describe('Election Coach — Tool Routing', () => {
  let coach: ElectionCoachService;

  beforeEach(() => {
    coach = new ElectionCoachService();
  });

  it('routes eligibility queries to static response', async () => {
    const response = await coach.chat('Can I vote at age 17?');
    expect(response.content.toLowerCase()).toContain('18');
  });

  it('routes registration queries correctly', async () => {
    const response = await coach.chat('How to register for voter ID?');
    expect(response.content).toContain('nvsp.in');
  });

  it('routes booth-finding queries correctly', async () => {
    const response = await coach.chat('Where is the nearest polling booth?');
    expect(response.content.toLowerCase()).toContain('booth');
  });

  it('tool declarations cover all required Google services', () => {
    const toolNames = ELECTION_TOOLS.map((t) => t.name);
    expect(toolNames).toContain('translate_text'); // Translate
    expect(toolNames).toContain('find_polling_location');     // Maps
    expect(toolNames).toContain('lookup_election_faq');       // FAQ
    expect(toolNames).toContain('check_voter_eligibility');   // Eligibility
    expect(toolNames).toContain('get_election_timeline');     // Timeline
  });
});

describe('Google Maps — Location Flow', () => {
  let maps: ElectionMapsService;

  beforeEach(() => {
    maps = new ElectionMapsService();
  });

  it('generates search links for various queries', () => {
    const queries = [
      'polling booth Andheri Mumbai',
      'election office Delhi',
      'voter registration centre Bangalore',
    ];

    queries.forEach((q) => {
      const link = maps.generateMapsLink(q);
      expect(link).toContain('google.com/maps');
    });
  });

  it('provides fallback locations when offline', async () => {
    const result = await maps.searchPollingLocations('Mumbai');
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
  });
});

describe('FAQ Search — Election Queries', () => {
  it('finds answers for common election questions', () => {
    const queries = ['NOTA', 'EVM', 'voter ID', 'postal ballot', 'NRI'];
    queries.forEach((q) => {
      const results = searchFaq(q);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('every FAQ answer is substantive', () => {
    ELECTION_FAQ.forEach((faq) => {
      expect(faq.answer.length).toBeGreaterThan(50);
    });
  });
});

describe('Timeline — Deadline Coverage', () => {
  it('has critical deadlines in the timeline', () => {
    const deadlines = getDeadlineEvents();
    expect(deadlines.length).toBeGreaterThanOrEqual(3);
    expect(deadlines.some((d) => d.priority === 'critical')).toBe(true);
  });

  it('timeline is sorted by priority', () => {
    const all = getAllTimelineEvents();
    const priorities = all.map((e) => e.priority);
    // Critical should come first
    expect(priorities[0]).toBe('critical');
  });
});

describe('State Management — Cross-layer Sync', () => {
  let appStore: ElectionStore;

  beforeEach(() => {
    appStore = new ElectionStore();
  });

  it('notifies subscribers on stage change', () => {
    const notifications: JourneyStageId[] = [];
    appStore.subscribe((state) => {
      notifications.push(state.currentStage);
    });

    appStore.goToStage(JourneyStageId.REGISTRATION);
    appStore.goToStage(JourneyStageId.POLLING_DAY);

    // Initial + 2 changes = 3 notifications
    expect(notifications).toHaveLength(3);
    expect(notifications[1]).toBe(JourneyStageId.REGISTRATION);
    expect(notifications[2]).toBe(JourneyStageId.POLLING_DAY);
  });

  it('supports election type selection', () => {
    appStore.selectElectionType(ElectionCategory.LOK_SABHA);
    expect(appStore.getState().selectedElectionType).toBe(ElectionCategory.LOK_SABHA);
  });

  it('coach panel toggle works', () => {
    expect(appStore.getState().isCoachOpen).toBe(false);
    appStore.toggleCoach();
    expect(appStore.getState().isCoachOpen).toBe(true);
    appStore.toggleCoach();
    expect(appStore.getState().isCoachOpen).toBe(false);
  });

  it('reset restores initial state', () => {
    appStore.goToStage(JourneyStageId.POST_VOTE);
    appStore.selectElectionType(ElectionCategory.PANCHAYAT);
    appStore.reset();
    const state = appStore.getState();
    expect(state.currentStage).toBe(JourneyStageId.ELIGIBILITY);
    expect(state.selectedElectionType).toBeNull();
  });

  it('unsubscribe stops notifications', () => {
    let count = 0;
    const unsub = appStore.subscribe(() => {
      count++;
    });

    unsub();
    appStore.goToStage(JourneyStageId.TIMELINE);
    // Only the initial call should have fired
    expect(count).toBe(1);
  });
});
