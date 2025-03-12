import { getEmail, loadEmails } from './access/gmail.ts'
import { getCalendar, loadCalendar } from './access/calendar.ts'
import { postToSheet } from './access/spreadsheets.ts'
import { db } from './lib/db.ts'

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

// export type UserId = 'agnes' | 'niki' | 'ellen'

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

// agnesOauth2Client.on('tokens', (tokens) => {
//   if (tokens.refresh_token) {
//     users.agnes.refreshToken = tokens.refresh_token
//   }
// })

// export const getAuthUrl = (userId: UserId) => {
//   const scopes = [
//     'https://www.googleapis.com/auth/gmail.readonly',
//     'https://www.googleapis.com/auth/calendar.readonly',
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

export const run = async () => {
  const resultByUser = []

  try {
    await loadEmails('ellen');
    await loadCalendar('ellen');
    const ellenEmails = await getEmail('ellen@hejare.se')
    resultByUser.push({
      user: 'Ellen',
      emailResult: ellenEmails,
      calendarResult: await getCalendar('ellen'),
      numberOfExternalEmailsSent: ellenEmails.reduce((n, { numberOfContacts }) => n + numberOfContacts, 0),
    })
    await loadEmails('niki');
    await loadCalendar('niki');
    const nikiEmails = await getEmail('niki@hejare.se')
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

  resultByUser.map((value) => {
    value.emailResult
  });

  await postToSheet({ resultByUser })

  return resultByUser
}
