import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { run } from './main.ts'
import { getEmail } from './access/gmail.ts'
import { getCalendar } from './access/calendar.ts'

const app = new Hono()

// app.get('/:userId', async (c) => {
//   const userId = c.req.param('userId') as UserId
//   return c.redirect(getAuthUrl(userId))
// })

// app.get('/:userId/response', async (c) => {
//   const userId = c.req.param('userId') as UserId
//   const authCode = c.req.query('code')
//   return c.json(handleAuthTokenResponse(authCode ?? '', userId))
// })

app.get('/:userId/email', async (c) => {
  const userId = c.req.param('userId')
  return c.json(await getEmail(userId))
})

app.get('/:userId/calendar', async (c) => {
  const userId = c.req.param('userId')
  return c.json(await getCalendar(userId))
})

app.get('/run', async (c) => {
  return c.json(await run())
})

serve(
  {
    fetch: app.fetch,
    port: parseInt(process.env.PORT ?? '3000'),
  },
  (info) => {
    console.log(`Server is running on http://${info.address}:${info.port}`)
  }
)
