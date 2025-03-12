import { gmail_v1, google } from 'googleapis'
import { getStartOfWorkWeek } from '../helpers/get-start-of-work-week.ts'
import { getAuthClient } from './auth.ts'
import { getUnique } from '../helpers/get-unique.ts'
import { checkForDomainsToIgnore } from '../helpers/check-for-domains-to-ignore.ts'
import { db } from '../lib/db.ts'
import { Mail, User } from '@prisma/client'
import { extractNameAndMail } from '../utils/index.ts'

export type GetEmailResponse = {
  domain: string
  numberOfContacts: number
  lastDate: string
}[]

export const loadEmails = async (userId: string) => {
  const startOfWorkWeek = getStartOfWorkWeek()
  const authClient = getAuthClient(userId)
  await authClient.authorize()
  const email = `${userId}@hejare.se`
  const gmail = google.gmail({ version: 'v1', auth: authClient })
  const emailsBasic = await gmail.users.messages.list({
    userId: email,
    q: `(from:${email} OR to:${email}) after:${startOfWorkWeek.toLocaleDateString()}`,
  })

  if (!emailsBasic.data.messages) return;

  let emails = await Promise.all(
    emailsBasic.data.messages?.map(async (message) => {
      const emailResponse = await gmail.users.messages.get({
        userId: email,
        id: message.id ?? '',
      })

      if (!emailResponse.data.payload) return;

      const { headers, body } = emailResponse.data.payload;

      const from = headers?.find((ih) => ih.name === "From")?.value;
      const to = headers?.find((ih) => ih.name === "To")?.value;
      const date = headers?.find((ih) => ih.name === "Date")?.value;
      const subject = headers?.find((ih) => ih.name === "Subject")?.value;

      if (!message.id || !from || !to) return undefined;

      return {
        id: message.id,
        from,
        to,
        date: date || "No date",
        subject: subject || "No subject",
      };
    })
  );

  const newUsers: Omit<User, "id">[] = [];

  const newEmails: (Mail | undefined)[] = await Promise.all(emails.map(async (e) => {
    if (!e) return;

    const existingMail = await db.mail.findFirst({ where: { id: e.id } });
    if (existingMail) return;

    const senderDetails = extractNameAndMail(e.from);
    const recipientDetails = extractNameAndMail(e.to);

    if (!senderDetails || !recipientDetails) return;

    if (!senderDetails.emails[0] || !recipientDetails.emails) return;

    const sen = await db.user.findFirst({ where: { email: senderDetails.emails[0] } });
    if (!sen) {
      console.log(`[Sender] Found no user ${senderDetails.emails[0]}`);
      const mail = senderDetails.emails[0];
      if (mail) {
        console.log(`[Sender] Inserting user ${mail}`);
        newUsers.push({ email: mail, name: senderDetails.name || null });
      }
    } else {
      console.log(`[Sender] User ${senderDetails.emails[0]} already exists`);
    }

    const rec = await db.user.findFirst({ where: { email: recipientDetails.emails[0] } });
    if (!rec) {
      console.log(`[Recipient] Found no user ${recipientDetails.emails[0]}`);
      const mail = recipientDetails.emails[0];
      if (mail) {
        console.log(`[Recipient] Inserting user ${mail}`);
        const existingUser = newUsers.find((u) => u.email === mail);
        if (!existingUser)
          newUsers.push({ email: mail, name: senderDetails.name || null });
      }
    } else {
      console.log(`[Recipient] User ${recipientDetails.emails[0]} already exists`);
    }

    return {
      id: e.id,
      sender: senderDetails.emails[0],
      recipients: recipientDetails.emails,
      topic: e.subject,
      date: new Date(e.date),
    };
  }));

  const uniqueNewUsers = [...new Map(newUsers.map(item =>
    [item['email'], item])).values()];

  if (uniqueNewUsers.length > 0) {
    await db.user.createMany({
      data: uniqueNewUsers
    })
  }

  const definedNewEmails = newEmails.filter((e) => e) as Mail[];

  if (definedNewEmails.length > 0) {
    await db.mail.createMany({
      data: definedNewEmails
    });
  }
};

export const getEmail = async (mail: string): Promise<GetEmailResponse> => {

  const mails = await db.mail.findMany({
    where: {
      OR: [
        {
          sender: mail
        },
        {
          recipients: {
            has: mail
          }
        }
      ]
    }
  });

  console.log(mails);

  const regexp = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g

  const filtered = mails.map((e) => {
    const to = e.recipients;
    const toEmails = to.map((val) => {
      return (
        val.matchAll(regexp)
          .toArray()
          .map((e) => e[0])
      )
    }).flat()

    const from = e.sender
    const fromEmails = from
      .matchAll(regexp)
      .toArray()
      .map((e) => e[0])

    const emailsToCheck = getUnique([...toEmails, ...fromEmails])

    const domains = getUnique(emailsToCheck.map((te) => te && te.split('@')[1]?.split('.')[0]))
    const externalDomains = domains.filter(checkForDomainsToIgnore)

    const date = e.date

    return {
      to: emailsToCheck,
      domains: domains,
      externalDomains: externalDomains,
      date: date ? new Date(date) : undefined,
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
