import { google } from 'googleapis'
import http from 'http'
import url from 'url'
import open from 'open'

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'http://localhost:3002'
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent',
})

console.log('Opening browser for Gmail authorisation...')
open(authUrl)

const server = http.createServer(async (req, res) => {
  const qs = new url.URL(req.url, 'http://localhost:3002').searchParams
  const code = qs.get('code')
  if (!code) return
  res.end('Authorised. You can close this tab.')
  server.close()
  const { tokens } = await oauth2Client.getToken(code)
  console.log('\nAdd this to your .env.local:')
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
})

server.listen(3002)