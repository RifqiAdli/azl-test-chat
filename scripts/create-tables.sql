-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  avatar TEXT NOT NULL,
  user_color TEXT NOT NULL,
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table for online status
CREATE TABLE IF NOT EXISTS chat_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT UNIQUE NOT NULL,
  avatar TEXT NOT NULL,
  user_color TEXT NOT NULL,
  is_online BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_users ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for demo purposes)
CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_users" ON chat_users FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_users_is_online_idx ON chat_users(is_online);
