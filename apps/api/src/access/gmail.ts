import { google } from 'googleapis'
import { getStartOfWorkWeek } from '../helpers/get-start-of-work-week.ts'
import { getAuthClient } from './auth.ts'
import { getUnique } from '../helpers/get-unique.ts'
import { checkForDomainsToIgnore } from '../helpers/check-for-domains-to-ignore.ts'

export type GetEmailResponse = {
  domain: string
  numberOfContacts: number
  lastDate: string
}[]

export const getEmail = async (userId: string): Promise<GetEmailResponse> => {
  const authClient = getAuthClient(userId)
  await authClient.authorize()
  const email = `${userId}@hejare.se`
  const startOfWorkWeek = getStartOfWorkWeek()

  const gmail = google.gmail({ version: 'v1', auth: authClient })
  const emailsBasic = await gmail.users.messages.list({
    userId: email,
    q: `(from:${email} OR to:${email}) after:${startOfWorkWeek.toLocaleDateString()}`,
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
    const externalDomains = domains.filter(checkForDomainsToIgnore)

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

  return byDomainWithCountAndLastDate
}
