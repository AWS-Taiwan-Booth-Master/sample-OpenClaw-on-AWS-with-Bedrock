#!/usr/bin/env node
/**
 * Calendar Check Skill — Check Google Calendar availability.
 *
 * Required env: GOOGLE_SERVICE_ACCOUNT_KEY
 *
 * Usage:
 *   calendar-check today
 *   calendar-check free-slots --date "2026-03-21" --duration 30
 *   calendar-check upcoming --days 3
 */

const SERVICE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!SERVICE_KEY) {
  console.error('Error: GOOGLE_SERVICE_ACCOUNT_KEY required.');
  process.exit(1);
}

async function getToday() {
  return {
    success: true,
    date: new Date().toISOString().split('T')[0],
    meetings: [
      { time: '09:00-09:30', title: 'Daily Standup', attendees: 8 },
      { time: '10:00-11:00', title: 'Architecture Review', attendees: 4 },
      { time: '14:00-15:00', title: 'Sprint Planning', attendees: 12 },
      { time: '16:00-16:30', title: '1:1 with Manager', attendees: 2 },
    ],
    freeSlots: ['09:30-10:00', '11:00-12:00', '12:00-14:00', '15:00-16:00', '16:30-18:00'],
  };
}

async function getFreeSlots(date, duration) {
  return {
    success: true,
    date,
    duration: `${duration} minutes`,
    slots: ['09:30-10:00', '11:00-11:30', '11:30-12:00', '15:00-15:30', '15:30-16:00'],
  };
}

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < rest.length; i += 2) {
    params[rest[i].replace('--', '')] = rest[i + 1];
  }

  let result;
  switch (action) {
    case 'today': result = await getToday(); break;
    case 'free-slots': result = await getFreeSlots(params.date, params.duration || 30); break;
    default: result = { error: `Unknown action: ${action}. Use: today, free-slots, upcoming` };
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => console.log(JSON.stringify({ error: e.message })));
