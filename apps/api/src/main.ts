import { google } from 'googleapis'

/**
 * Vi använder ett service account med domain-wide delegation. Det gör dock att vi har tillgång till hela skoj-organisationens privata mailkorgar osv - inte så nice!
 * Eventuellt vill vi använda personliga oauth-tokens istället och kräva en första inloggning (så vi får ett refreshtoken) till de som ska använda appen.
 * Den utkommenterade koden används till det!
 */

// const getOauth2Client = (userId: string) =>
//   new google.auth.OAuth2({
//     clientId: clientCredentials.default.web.client_id,
//     clientSecret: clientCredentials.default.web.client_secret,
//     redirectUri: `http://localhost:3000/${userId}/response`,
//   })

// const agnesOauth2Client = getOauth2Client('agnes')
// const ellenOauth2Client = getOauth2Client('ellen')
// const nikiOauth2Client = getOauth2Client('niki')

// type UserProps = {
//   email: string
//   authCode: string
//   refreshToken: string
//   oauth2Client: typeof agnesOauth2Client
// }

// export const users: Record<UserId, UserProps> = {
//   agnes: {
//     email: 'agnes@hejare.se',
//     authCode: '',
//     refreshToken:
//       '1//0cPx3XvlG9lO6CgYIARAAGAwSNwF-L9Ir9DUpXFpSvByDVlwdpZViQUDwqdSGVsctkrC0nyjl3c3xa9II1onLsEZhUHxqEwyP2Uw',
//     oauth2Client: agnesOauth2Client,
//   },
//   ellen: {
//     email: 'ellen@hejare.se',
//     authCode: '',
//     refreshToken: '',
//     oauth2Client: ellenOauth2Client,
//   },
//   niki: {
//     email: 'niki@hejare.se',
//     authCode: '',
//     refreshToken: '',
//     oauth2Client: nikiOauth2Client,
//   },
// }
//
// agnesOauth2Client.on('tokens', (tokens) => {
//   if (tokens.refresh_token) {
//     users.agnes.refreshToken = tokens.refresh_token
//   }
// })

// export const getAuthUrl = (userId: UserId) => {
//   const scopes = [
//     'https://www.googleapis.com/auth/gmail.readonly',
//     'https://www.googleapis.com/auth/calendar',
//     'https://www.googleapis.com/auth/spreadsheets',
//   ]
//   const oauth2Client = users[userId]?.oauth2Client
//   if (!oauth2Client) throw new Error('Could not find oauth2Client for user')

//   const url = oauth2Client.generateAuthUrl({
//     access_type: 'offline',
//     scope: scopes,
//   })

//   return url
// }

// export const handleAuthTokenResponse = async (code: string, userId: UserId) => {
//   const userData = users[userId]
//   if (!userData) throw new Error('Could not find userData for user')

//   const oauth2Client = users[userId]?.oauth2Client
//   userData.authCode = code

//   if (Object.keys(oauth2Client.credentials).length === 0) {
//     const { tokens } = await oauth2Client.getToken(code)
//     console.log({ tokens })
//     if (!tokens.refresh_token) {
//       oauth2Client.setCredentials({
//         ...tokens,
//         refresh_token: userData.refreshToken,
//       })
//     } else {
//       oauth2Client.setCredentials(tokens)
//     }
//   }
// }

const spreadsheetId = '1FIRtWL22u-U-KrhfhXcEPqONoXDLnhEC0OFeiKZICRw'

const getAuthClient = (userId: string) =>
  new google.auth.JWT({
    keyFile: 'google-service-account-private-key.json',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    subject: `${userId}@hejare.se`,
  })

type GetEmailResponse = {
  domain: string
  numberOfContacts: number
  lastDate: string
}[]

export const getEmail = async (userId: string): Promise<GetEmailResponse> => {
  const authClient = getAuthClient(userId)
  await authClient.authorize()
  const email = `${userId}@hejare.se`
  const mondayThisWeek = getStartOfWorkWeek()

  // console.log(mondayThisWeek.toLocaleDateString())

  const gmail = google.gmail({ version: 'v1', auth: authClient })
  const emailsBasic = await gmail.users.messages.list({
    userId: email,
    q: `from:${email} after:${mondayThisWeek.toLocaleDateString()}`,
  })

  if (!emailsBasic.data.messages) return []

  const emails = await Promise.all(
    emailsBasic.data.messages?.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: email,
        id: message.id ?? '',
      })

      if (!emailResponse.data.payload) return

      const { headers, body } = emailResponse.data.payload
      return { headers, body }
    })
  )

  const regexp = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g

  const filtered = emails.map((e) => {
    const to = e?.headers?.find((ih) => ih.name === 'To')
    if (!to || !to.value) return
    const toEmails = to.value
      .matchAll(regexp)
      .toArray()
      .map((e) => e[0])

    const from = e?.headers?.find((ih) => ih.name === 'From')
    if (!from || !from.value) return
    const fromEmails = to.value
      .matchAll(regexp)
      .toArray()
      .map((e) => e[0])

    const emailsToCheck = getUnique([...toEmails, ...fromEmails])

    const domains = getUnique(emailsToCheck.map((te) => te && te.split('@')[1]?.split('.')[0]))
    const externalDomains = domains.filter(checkForEmailToIgnore)

    const date = e?.headers?.find((ih) => ih.name === 'Date')

    return {
      to: emailsToCheck,
      domains: domains,
      externalDomains: externalDomains,
      date: date?.value ? new Date(date.value) : undefined,
    }
  })

  const byDomain: Record<string, Array<any>> = {}
  filtered.forEach((d) => {
    if (!d) return
    const domain = d.externalDomains[0]
    if (!domain) return
    const arr = byDomain[domain] ?? []
    arr.push(d)
    byDomain[domain] = arr
  })

  const byDomainWithCountAndLastDate: Array<{ domain: string; numberOfContacts: number; lastDate: string }> = []

  Object.keys(byDomain).forEach((key) => {
    if (!byDomain[key]) return
    byDomainWithCountAndLastDate.push({
      domain: key,
      numberOfContacts: byDomain[key].length,
      lastDate: new Date(Math.max(...byDomain[key].map((e) => e.date))).toLocaleDateString(),
    })
  })

  // const mostContacts = Math.max(...Object.keys(byDomainWithCount).map((e) => byDomainWithCount[e]?.numberOfContacts ?? 0))

  return byDomainWithCountAndLastDate
}

export const getCalendar = async (userId: string) => {
  const email = `${userId}@hejare.se`
  const authClient = getAuthClient(userId)
  await authClient.authorize()

  const calendar = google.calendar({ version: 'v3', auth: authClient })
  const mondayThisWeek = getStartOfWorkWeek().toISOString()
  const fridayThisWeek = getEndOfWorkWeek().toISOString()

  const events = await calendar.events.list({
    calendarId: email,
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: mondayThisWeek,
    timeMax: fridayThisWeek,
  })

  if (!events.data.items) return

  const eventsWithNonHejareParticipants = events.data.items.filter(
    (item) =>
      item.attendees
        ?.filter((attendee) => attendee.responseStatus !== 'declined')
        .some((attendee) => checkForEmailToIgnore(attendee.email)) &&
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
      start: a.start,
    }))

  return filteredOutLargeEvents
}

// Taget från https://weeknumber.net/how-to/javascript
const getWeek = (dateInput: Date) => {
  let date = new Date(dateInput.getTime())
  date.setHours(0, 0, 0, 0)
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  // January 4 is always in week 1.
  let week1 = new Date(date.getFullYear(), 0, 4)
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

export const getStartOfWorkWeek = () => {
  const today = new Date()
  const weekday = today.getDay()
  const mondayThisWeek = new Date(today)
  mondayThisWeek.setDate(today.getDate() - weekday + 1)
  mondayThisWeek.setHours(0, 0, 0)

  return mondayThisWeek
}

export const getEndOfWorkWeek = () => {
  const today = new Date()
  const weekday = today.getDay()
  const fridayThisWeek = new Date(today)
  fridayThisWeek.setDate(today.getDate() + 5 - weekday)
  fridayThisWeek.setHours(17, 0, 0)

  return fridayThisWeek
}

const checkForEmailToIgnore = (s?: string | null) => {
  return !domainsToIgnore.some((d) => s?.includes(d))
}

const getUnique = (array: Array<string | undefined>) => {
  return array.filter((v, i, a) => a.indexOf(v) === i)
}

const domainsToIgnore = [
  'hejare',
  'theodoratech',
  'momang',
  'skoj',
  'careof',
  'calendar.google.com',
  'gmail',
  'hotmail',
  'mailer',
  'info',
  'eu-north-1',
  'outbound-eu',
  'email',
  'eu-west-1',
  'a-mail-02',
  'customer-658-a104',
  'catering',
]

export const getSheet = async (userId: string) => {
  const authClient = getAuthClient(userId)
  await authClient.authorize()

  const sheets = google.sheets({ version: 'v4', auth: authClient })
  const res = sheets.spreadsheets.get({
    spreadsheetId,
  })

  return res
}

export const run = async () => {
  const mondayThisWeek = getStartOfWorkWeek()
  const currentWeekNumber = getWeek(mondayThisWeek)
  const currentYear = mondayThisWeek.getFullYear()

  const authClient = getAuthClient('agnes')
  await authClient.authorize()

  const resultByUser = []

  try {
    const ellenEmails = await getEmail('ellen')
    resultByUser.push({
      user: 'Ellen',
      emailResult: ellenEmails,
      calendarResult: await getCalendar('ellen'),
      numberOfExternalEmailsSent: ellenEmails.reduce((n, { numberOfContacts }) => n + numberOfContacts, 0),
    })
    const nikiEmails = await getEmail('niki')
    resultByUser.push({
      user: 'Niki',
      emailResult: nikiEmails,
      calendarResult: await getCalendar('niki'),
      numberOfExternalEmailsSent: nikiEmails.reduce((n, { numberOfContacts }) => n + numberOfContacts, 0),
    })
  } catch (error) {
    console.error('Something went wrong', error)
    return
  }

  const { spreadsheets } = google.sheets({ version: 'v4', auth: authClient })
  const sheetTitle = `Vecka ${currentWeekNumber} ${currentYear}`
  const sheetId = parseInt(`${currentWeekNumber}${currentYear}`)

  const spreadsheet = await spreadsheets.get({
    spreadsheetId,
  })

  const doesSheetExist = spreadsheet.data.sheets?.find((s) => s.properties?.sheetId === sheetId)

  const [ellenResult, nikiResult] = resultByUser

  const longestDomainArray =
    (ellenResult?.emailResult.length ?? 0) > (nikiResult?.emailResult.length ?? 0)
      ? ellenResult?.emailResult
      : nikiResult?.emailResult

  const requests = []
  if (!doesSheetExist) {
    requests.push({
      addSheet: {
        properties: {
          title: sheetTitle,
          sheetId,
        },
      },
    })
  }
  requests.push({
    updateCells: {
      rows: [
        {
          values: [
            {},
            {
              userEnteredValue: {
                stringValue: 'Skickade externa mail',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            {
              userEnteredValue: {
                stringValue: 'Externa möten',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
          ],
        },
        {
          values: [
            {
              userEnteredValue: {
                stringValue: 'Ellen',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            {
              userEnteredValue: {
                numberValue: ellenResult?.numberOfExternalEmailsSent,
              },
            },
            {
              userEnteredValue: {
                numberValue: ellenResult?.calendarResult?.length,
              },
            },
          ],
        },
        {
          values: [
            {
              userEnteredValue: {
                stringValue: 'Niki',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            {
              userEnteredValue: {
                numberValue: nikiResult?.numberOfExternalEmailsSent,
              },
            },
            {
              userEnteredValue: {
                numberValue: nikiResult?.calendarResult?.length,
              },
            },
          ],
        },
        {},
        {
          values: [
            {},
            {
              userEnteredValue: {
                stringValue: 'Externa mail Ellen',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            {
              userEnteredValue: {
                stringValue: 'Externa mail Niki',
              },
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
          ],
        },
        ...(longestDomainArray
          ? longestDomainArray?.map((_e, i) => ({
              values: [
                {},
                {
                  userEnteredValue: {
                    stringValue: ellenResult?.emailResult[i]?.domain,
                  },
                },
                {
                  userEnteredValue: {
                    stringValue: nikiResult?.emailResult[i]?.domain,
                  },
                },
              ],
            }))
          : []),
      ],
      fields: '*',
      range: {
        sheetId,
        startRowIndex: 0,
      },
    },
  })

  return await spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      includeSpreadsheetInResponse: true,
      requests,
    },
  })
}
