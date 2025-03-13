import { google } from 'googleapis'
import { getAuthClient } from './auth.ts'
import { getStartOfWorkWeek } from '../helpers/get-start-of-work-week.ts'
import { getEndOfWorkWeek } from '../helpers/get-end-of-work-week.ts'
import { checkForDomainsToIgnore } from '../helpers/check-for-domains-to-ignore.ts'
import { db } from '../lib/db.ts'
import { Event } from '@prisma/client'


export type GetCalendarResponse = {
  summary?: string | null
  attendees?: (string | null | undefined)[]
  start?: Date
}[]

export const loadCalendar = async (userId: string) => {
  const email = `${userId}@hejare.se`
  const authClient = getAuthClient(userId)
  await authClient.authorize()

  const calendar = google.calendar({ version: 'v3', auth: authClient })
  const startOfWorkWeek = getStartOfWorkWeek().toISOString()
  const endOfWorkWeek = getEndOfWorkWeek().toISOString()

  const events = await calendar.events.list({
    calendarId: email,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: startOfWorkWeek,
    timeMax: endOfWorkWeek,
  })

  if (!events.data.items) return []

  const dbEvents = await db.event.findMany({});

  const newEvents = events.data.items.filter((item) => !dbEvents.find((dbe) => dbe.id === item.id));

  const eventsWithNonHejareParticipants = newEvents.filter(
    (item) =>
      item.attendees
        ?.filter((attendee) => attendee.responseStatus !== 'declined')
        .some((attendee) => checkForDomainsToIgnore(attendee.email)) &&
      item.start?.dateTime &&
      new Date(item.start.dateTime).getHours() < 17
  )

  const filteredOutOrganisedByReqruiters = eventsWithNonHejareParticipants.filter(
    (item) =>
      item.organizer && !item.organizer.email?.includes('emma@hejare.se') && !item.organizer.email?.includes('bernhard')
  )

  const filteredOutLargeEvents = filteredOutOrganisedByReqruiters
    .filter((item) => item.attendees && item.attendees.length < 10)
    .map((a) => ({
      id: a.id,
      summary: a.summary,
      organizer: a.organizer?.email,
      attendees: a.attendees?.map((at) => at.email),
      date: a.start?.dateTime ? new Date(a.start.dateTime) : null,
    }));

  const eventsInsert = filteredOutLargeEvents.filter((e) => e && e.id) as Event[];

  if (eventsInsert.length > 0) {
    await db.event.createMany({ data: eventsInsert })
  }

  return eventsInsert
};

export const getCalendar = async (userId: string): Promise<GetCalendarResponse> => {
  const email = `${userId}@hejare.se`

  const events = await db.event.findMany({
    where: {
      OR: [
        {
          organizer: email
        },
        {
          attendees: {
            has: email
          }
        }
      ]
    }
  })

  return events;
}
