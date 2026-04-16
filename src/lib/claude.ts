// Claude API wrapper for AI race parsing features.
// API key is user-supplied, stored in localStorage under 'fl2_claude_key'.

export interface ParsedRace {
  name?: string
  date?: string       // YYYY-MM-DD
  city?: string
  country?: string
  distance?: string   // numeric km string e.g. "42.2"
  sport?: string
  time?: string       // HH:MM:SS
  placing?: string    // e.g. "342/5000"
  splits?: { label: string; split?: string; cumulative?: string }[]
}

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | { type: string; [key: string]: unknown }[]
}

export function getClaudeApiKey(): string {
  return localStorage.getItem('fl2_claude_key') ?? ''
}

async function callClaude(messages: ClaudeMessage[], apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `Claude API error ${res.status}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

/**
 * Parse a pasted race result text and extract structured data.
 * Returns partial ParsedRace — caller fills in missing fields.
 */
export async function parseRaceText(text: string, apiKey: string): Promise<ParsedRace> {
  const prompt = `Extract race result data from the following text. Return ONLY a JSON object with these fields (omit any you can't determine):
- name: race name (string)
- date: race date as YYYY-MM-DD (string)
- city: city (string)
- country: country (string)
- distance: distance in km as a number string e.g. "42.2" (string)
- sport: one of "Running", "Triathlon", "Cycling", "Swimming", "HYROX" (string)
- time: finish time as HH:MM:SS (string)
- placing: placement e.g. "342/5000" or "3rd AG" (string)
- splits: array of { label, split, cumulative } objects (split and cumulative are HH:MM:SS strings)

Text:
${text}

Respond with only the JSON object, no explanation.`

  const reply = await callClaude([{ role: 'user', content: prompt }], apiKey)
  try {
    const json = reply.match(/\{[\s\S]*\}/)
    return json ? (JSON.parse(json[0]) as ParsedRace) : {}
  } catch {
    return {}
  }
}

/**
 * Parse a race results screenshot (base64 image) and extract structured data.
 */
export async function importRaceScreenshot(imageBase64: string, mimeType: string, apiKey: string): Promise<ParsedRace> {
  const messages: ClaudeMessage[] = [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: imageBase64,
        },
      },
      {
        type: 'text',
        text: `Extract race result data from this image. Return ONLY a JSON object with these fields (omit any you can't determine):
- name: race name (string)
- date: race date as YYYY-MM-DD (string)
- city: city (string)
- country: country (string)
- distance: distance in km as a number string e.g. "42.2" (string)
- sport: one of "Running", "Triathlon", "Cycling", "Swimming", "HYROX" (string)
- time: finish time as HH:MM:SS (string)
- placing: placement e.g. "342/5000" or "3rd AG" (string)
- splits: array of { label, split, cumulative } objects (split and cumulative are HH:MM:SS strings)

Respond with only the JSON object, no explanation.`,
      },
    ],
  }]

  const reply = await callClaude(messages, apiKey)
  try {
    const json = reply.match(/\{[\s\S]*\}/)
    return json ? (JSON.parse(json[0]) as ParsedRace) : {}
  } catch {
    return {}
  }
}
