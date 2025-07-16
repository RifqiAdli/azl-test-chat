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
-- Add mentions and hashtags columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS mentions TEXT[],
ADD COLUMN IF NOT EXISTS hashtags TEXT[];

-- Create indexes for tag queries
CREATE INDEX IF NOT EXISTS messages_mentions_idx ON messages USING GIN (mentions);
CREATE INDEX IF NOT EXISTS messages_hashtags_idx ON messages USING GIN (hashtags);

-- Create a function to extract mentions and hashtags
CREATE OR REPLACE FUNCTION extract_tags_from_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract mentions (@username)
  NEW.mentions := ARRAY(
    SELECT DISTINCT regexp_replace(match[1], '^@', '')
    FROM regexp_split_to_table(NEW.content, '\s+') AS word,
         regexp_matches(word, '@(\w+)', 'g') AS match
  );
  
  -- Extract hashtags (#hashtag)
  NEW.hashtags := ARRAY(
    SELECT DISTINCT regexp_replace(match[1], '^#', '')
    FROM regexp_split_to_table(NEW.content, '\s+') AS word,
         regexp_matches(word, '#(\w+)', 'g') AS match
  );
  
  -- Remove empty arrays
  IF array_length(NEW.mentions, 1) IS NULL THEN
    NEW.mentions := NULL;
  END IF;
  
  IF array_length(NEW.hashtags, 1) IS NULL THEN
    NEW.hashtags := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically extract tags
DROP TRIGGER IF EXISTS extract_tags_trigger ON messages;
CREATE TRIGGER extract_tags_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION extract_tags_from_content();

-- Update existing messages to extract tags
UPDATE messages 
SET content = content 
WHERE content IS NOT NULL;
-- Add reply columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id),
ADD COLUMN IF NOT EXISTS reply_to_user TEXT,
ADD COLUMN IF NOT EXISTS reply_to_content TEXT;

-- Create index for reply queries
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON messages(reply_to_id);

-- Update the existing messages view if needed
CREATE OR REPLACE VIEW messages_with_replies AS
SELECT 
  m.*,
  rm.user_name as replied_user_name,
  rm.content as replied_content
FROM messages m
LEFT JOIN messages rm ON m.reply_to_id = rm.id
ORDER BY m.created_at DESC;
-- Create WebRTC signaling table for real voice communication
CREATE TABLE IF NOT EXISTS radio_signaling (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  channel INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  data TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE radio_signaling ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on radio_signaling" ON radio_signaling FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS radio_signaling_to_user_idx ON radio_signaling(to_user);
CREATE INDEX IF NOT EXISTS radio_signaling_channel_idx ON radio_signaling(channel);
CREATE INDEX IF NOT EXISTS radio_signaling_timestamp_idx ON radio_signaling(timestamp DESC);
CREATE INDEX IF NOT EXISTS radio_signaling_processed_idx ON radio_signaling(processed);

-- Update radio_users table to support voice features
ALTER TABLE radio_users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true;
ALTER TABLE radio_users ADD COLUMN IF NOT EXISTS peer_id TEXT;

-- Create index for online users
CREATE INDEX IF NOT EXISTS radio_users_is_online_idx ON radio_users(is_online);
-- Create radio users table
CREATE TABLE IF NOT EXISTS radio_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign TEXT UNIQUE NOT NULL,
  channel INTEGER NOT NULL DEFAULT 0,
  is_transmitting BOOLEAN DEFAULT false,
  signal_strength INTEGER DEFAULT 100,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create radio messages table
CREATE TABLE IF NOT EXISTS radio_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign TEXT NOT NULL,
  channel INTEGER NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('voice', 'text', 'system')) DEFAULT 'text',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration INTEGER, -- for voice messages in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE radio_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_messages ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for demo purposes)
CREATE POLICY "Allow all operations on radio_users" ON radio_users FOR ALL USING (true);
CREATE POLICY "Allow all operations on radio_messages" ON radio_messages FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS radio_users_channel_idx ON radio_users(channel);
CREATE INDEX IF NOT EXISTS radio_users_last_seen_idx ON radio_users(last_seen);
CREATE INDEX IF NOT EXISTS radio_messages_channel_idx ON radio_messages(channel);
CREATE INDEX IF NOT EXISTS radio_messages_timestamp_idx ON radio_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS radio_messages_callsign_idx ON radio_messages(callsign);

-- Insert some sample channels/frequencies
INSERT INTO radio_messages (callsign, channel, message, message_type, timestamp) VALUES
('SYSTEM', 0, 'Channel 146.520 MHz - Simplex 1 ready for operation', 'system', NOW()),
('SYSTEM', 1, 'Channel 146.540 MHz - Emergency channel active', 'system', NOW()),
('SYSTEM', 2, 'Channel 147.000 MHz - Repeater 1 online', 'system', NOW());
-- Update RLS policies untuk allow delete operations
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;

-- Create more specific policies
CREATE POLICY "Allow read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update messages" ON messages FOR UPDATE USING (true);
CREATE POLICY "Allow delete messages" ON messages FOR DELETE USING (true);

-- Make sure RLS is enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';
-- Fix radio_users table to handle UUID properly
-- Drop and recreate with proper UUID handling

-- First backup existing data if any
CREATE TABLE IF NOT EXISTS radio_users_backup AS SELECT * FROM radio_users;

-- Drop existing table
DROP TABLE IF EXISTS radio_users CASCADE;

-- Recreate with proper UUID
CREATE TABLE radio_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  callsign TEXT NOT NULL,
  channel INTEGER NOT NULL DEFAULT 0,
  is_transmitting BOOLEAN DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  signal_strength INTEGER DEFAULT 100,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  peer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add unique constraint on callsign per channel for active users
  UNIQUE(callsign, channel, is_online)
);

-- Enable Row Level Security
ALTER TABLE radio_users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on radio_users" ON radio_users FOR ALL USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS radio_users_channel_idx ON radio_users(channel);
CREATE INDEX IF NOT EXISTS radio_users_is_online_idx ON radio_users(is_online);
CREATE INDEX IF NOT EXISTS radio_users_last_seen_idx ON radio_users(last_seen);
CREATE INDEX IF NOT EXISTS radio_users_callsign_idx ON radio_users(callsign);

-- Clean up old data periodically (users offline for more than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_offline_radio_users()
RETURNS void AS $$
BEGIN
  DELETE FROM radio_users 
  WHERE is_online = false 
  AND last_seen < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
-- Add multimedia columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'audio', 'voice')),
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_name TEXT,
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Create index for media queries
CREATE INDEX IF NOT EXISTS messages_media_type_idx ON messages(media_type);
