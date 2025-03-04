import { google } from 'googleapis'

export const getAuthClient = (userId: string) =>
  new google.auth.JWT({
    keyFile: 'google-service-account-private-key.json',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    subject: `${userId}@hejare.se`,
  })
