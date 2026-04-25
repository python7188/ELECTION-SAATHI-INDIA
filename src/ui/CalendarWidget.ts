/**
 * Calendar Widget — Election Reminder UI.
 *
 * Renders a set of one-click "Add to Google Calendar" buttons
 * for critical election dates: registration deadline, polling day,
 * and counting day.
 *
 * Uses deep-links — no OAuth required. Opens Google Calendar
 * in a new tab with the event pre-filled.
 *
 * @module ui/CalendarWidget
 */

import { ElectionCalendarService } from '../services/calendar';

/** Icon map for reminder categories. */
const CATEGORY_ICONS: Record<string, string> = {
  registration: '📝',
  polling: '🗳️',
  counting: '📊',
  deadline: '⚠️',
  general: '📅',
};

/**
 * Calendar reminder widget for the Election Coach section.
 *
 * Displays election date cards with direct Google Calendar
 * deep-links for one-click reminder creation.
 */
export class CalendarWidget {
  private readonly calendar: ElectionCalendarService;

  constructor() {
    this.calendar = new ElectionCalendarService();
    this.render();
  }

  /**
   * Render the calendar reminders widget into the coach section.
   */
  private render(): void {
    const coach = document.getElementById('coach-panel');
    if (!coach) {
      return;
    }

    const widget = document.createElement('section');
    widget.id = 'calendar-widget';
    widget.className = 'card';
    widget.style.cssText = 'max-width: 640px; margin: var(--space-4) auto 0;';
    widget.setAttribute('aria-labelledby', 'calendar-widget-heading');

    const heading = document.createElement('h3');
    heading.id = 'calendar-widget-heading';
    heading.style.cssText = 'color: var(--navy); margin-bottom: var(--space-2);';
    heading.textContent = '📅 Election Reminders — Add to Google Calendar';
    widget.appendChild(heading);

    const subheading = document.createElement('p');
    subheading.style.cssText = 'color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);';
    subheading.textContent = 'Never miss a key election date. Click any reminder to add it directly to your Google Calendar.';
    widget.appendChild(subheading);

    widget.appendChild(this.buildReminderList());

    const note = document.createElement('p');
    note.style.cssText = 'margin-top: var(--space-3); font-size: var(--text-xs); color: var(--text-muted);';
    note.textContent = 'Powered by Google Calendar. Dates are indicative — verify with eci.gov.in for confirmed schedules.';
    widget.appendChild(note);

    coach.appendChild(widget);
  }

  /**
   * Build the list of reminder cards.
   *
   * @returns UL element with all reminder items.
   */
  private buildReminderList(): HTMLUListElement {
    const reminders = this.calendar.getAllReminders();
    const list = document.createElement('ul');
    list.setAttribute('role', 'list');
    list.style.cssText = 'list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-3);';

    reminders.forEach((reminder) => {
      const link = this.calendar.generateCalendarLink(reminder);
      const icon = CATEGORY_ICONS[reminder.category] ?? '📅';

      const li = document.createElement('li');
      li.style.cssText = [
        'padding: var(--space-3);',
        'background: var(--bg-elevated);',
        'border-radius: var(--radius-md);',
        `border-left: 3px solid ${reminder.isDeadline ? 'var(--saffron, #FF9933)' : 'var(--navy, #000080)'};`,
      ].join('');

      const titleEl = document.createElement('p');
      titleEl.style.cssText = 'font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1);';
      titleEl.textContent = `${icon} ${reminder.title}`;

      const dateEl = document.createElement('p');
      dateEl.style.cssText = 'font-size: var(--text-xs); color: var(--text-muted); margin-bottom: var(--space-2);';
      dateEl.textContent = new Date(reminder.startDate).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      const calLink = document.createElement('a');
      calLink.href = link;
      calLink.target = '_blank';
      calLink.rel = 'noopener noreferrer';
      calLink.className = 'btn btn-secondary';
      calLink.style.cssText = 'font-size: var(--text-xs); display: inline-block;';
      calLink.setAttribute('aria-label', `Add "${reminder.title}" to Google Calendar`);
      calLink.textContent = '+ Add to Google Calendar ↗';

      li.appendChild(titleEl);
      li.appendChild(dateEl);
      li.appendChild(calLink);
      list.appendChild(li);
    });

    return list;
  }
}
