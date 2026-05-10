const APOLLO_API_KEY = process.env.APOLLO_API_KEY!

export async function lookupDirectorEmail(
  directorName: string,
  companyName: string,
  domain?: string
): Promise<{ email: string | null; confidence: string | null }> {
  try {
    const nameParts = directorName.trim().split(' ')
    const firstName = nameParts[0]
    const lastName = nameParts[nameParts.length - 1]

    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        organization_name: companyName,
        domain: domain || undefined,
        reveal_personal_emails: false,
      }),
    })

    const data = await res.json()
    const person = data.person

    if (!person) return { email: null, confidence: null }

    return {
      email: person.email || null,
      confidence: person.email_status || null,
    }
  } catch (err) {
    console.error('Apollo lookup error:', err)
    return { email: null, confidence: null }
  }
}