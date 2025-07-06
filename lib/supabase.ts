import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables. Please check your .env.local file.")
  }

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  })

  return _client
}

export type Message = {
  id: string
  user_name: string
  content: string
  avatar: string
  user_color: string
  reactions: { [key: string]: number }
  created_at: string
}

export type ChatUser = {
  id: string
  user_name: string
  avatar: string
  user_color: string
  is_online: boolean
  last_seen: string
  created_at: string
}
