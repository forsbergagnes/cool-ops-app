import { google } from 'googleapis'
import { getAuthClient } from './auth.ts'
import { getStartOfWorkWeek } from '../helpers/get-start-of-work-week.ts'
import { getEndOfWorkWeek } from '../helpers/get-end-of-work-week.ts'
import { checkForDomainsToIgnore } from '../helpers/check-for-domains-to-ignore.ts'

export type GetCalendarResponse = {
  summary?: string | null
  attendees?: (string | null | undefined)[]
  start?: Date
}[]

export const getCalendar = async (userId: string): Promise<GetCalendarResponse> => {
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

  const eventsWithNonHejareParticipants = events.data.items.filter(
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
      summary: a.summary,
      attendees: a.attendees?.map((at) => at.email),
      start: new Date(a.start?.date ?? ''),
    }))

  return filteredOutLargeEvents
}
