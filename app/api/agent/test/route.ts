import { NextResponse } from 'next/server'

export async function GET() {
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
const res = await fetch(`${baseUrl}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await res.json()
  return NextResponse.json(data)
}