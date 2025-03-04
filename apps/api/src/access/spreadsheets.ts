import { google } from 'googleapis'
import { getAuthClient } from './auth.ts'
import { getStartOfWorkWeek } from '../helpers/get-start-of-work-week.ts'
import { getWeek } from '../helpers/get-week-number.ts'
import { GetEmailResponse } from './gmail.ts'
import { GetCalendarResponse } from './calendar.ts'

const spreadsheetId = '1FIRtWL22u-U-KrhfhXcEPqONoXDLnhEC0OFeiKZICRw'

type PostToSheetProps = {
  resultByUser: {
    user: string
    emailResult: GetEmailResponse
    calendarResult: GetCalendarResponse
    numberOfExternalEmailsSent: number
  }[]
}

export const postToSheet = async ({ resultByUser }: PostToSheetProps) => {
  const authClient = getAuthClient('agnes')
  await authClient.authorize()

  const mondayThisWeek = getStartOfWorkWeek()
  const currentWeekNumber = getWeek(mondayThisWeek)
  const currentYear = mondayThisWeek.getFullYear()

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
