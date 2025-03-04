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

export const checkForDomainsToIgnore = (s?: string | null) => {
  return !domainsToIgnore.some((d) => s?.includes(d))
}
