import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { getCalendar, getEmail, getSheet, run } from './main.ts'

const app = new Hono()

// app.get('/{userId}', async (c) => {
//   const userId = c.req.param('userId') as UserId
//   return c.redirect(getAuthUrl(userId))
// })

// app.get('/{userId}/response', async (c) => {
//   const userId = c.req.param('userId') as UserId
//   const authCode = c.req.query('code')
//   return c.json(handleAuthTokenResponse(authCode ?? '', userId))
// })

app.get('/:userId/email', async (c) => {
  const userId = c.req.param('userId')
  const res = await getEmail(userId)
  // console.log(res)
  return c.json(res)
})

app.get('/:userId/calendar', async (c) => {
  const userId = c.req.param('userId')
  const res = await getCalendar(userId)
  return c.json(res)
})

app.get('/:userId/sheet', async (c) => {
  const userId = c.req.param('userId')
  const res = await getSheet(userId)
  return c.json(res)
})

app.get('/run', async (c) => {
  return c.json(await run())
  // return c.json(res)
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
