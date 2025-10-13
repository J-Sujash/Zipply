-- Messages System Database Schema for Zipply App
-- Run this in your Supabase SQL editor

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique conversation per ride-driver-passenger combination
    UNIQUE(ride_id, driver_id, passenger_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'location')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_driver_id ON conversations(driver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_passenger_id ON conversations(passenger_id);
CREATE INDEX IF NOT EXISTS idx_conversations_ride_id ON conversations(ride_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
-- Users can only see conversations they are part of (as driver or passenger)
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (
        auth.uid() = driver_id OR 
        auth.uid() = passenger_id
    );

-- Users can create conversations if they are the driver or passenger
CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (
        auth.uid() = driver_id OR 
        auth.uid() = passenger_id
    );

-- Users can update conversations they are part of
CREATE POLICY "Users can update their conversations" ON conversations
    FOR UPDATE USING (
        auth.uid() = driver_id OR 
        auth.uid() = passenger_id
    );

-- RLS Policies for messages
-- Users can only see messages in conversations they are part of
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.driver_id = auth.uid() OR conversations.passenger_id = auth.uid())
        )
    );

-- Users can send messages in conversations they are part of
CREATE POLICY "Users can send messages in their conversations" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.driver_id = auth.uid() OR conversations.passenger_id = auth.uid())
        )
    );

-- Users can update their own messages (for read status, etc.)
CREATE POLICY "Users can update messages in their conversations" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND (conversations.driver_id = auth.uid() OR conversations.passenger_id = auth.uid())
        )
    );

-- Function to update conversation's last_message_at when a new message is sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET 
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update conversation timestamp
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Function to automatically create conversation when ride request is approved
CREATE OR REPLACE FUNCTION create_conversation_on_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create conversation when request is approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        INSERT INTO conversations (ride_id, driver_id, passenger_id)
        SELECT 
            NEW.ride_id,
            rides.driver_id,
            NEW.user_id
        FROM rides 
        WHERE rides.id = NEW.ride_id
        ON CONFLICT (ride_id, driver_id, passenger_id) DO NOTHING;
        
        -- Send welcome system message
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        SELECT 
            c.id,
            rides.driver_id,
            'Your ride request has been approved! Feel free to message each other about pickup details.',
            'system'
        FROM conversations c
        JOIN rides ON rides.id = c.ride_id
        WHERE c.ride_id = NEW.ride_id 
        AND c.passenger_id = NEW.user_id
        AND c.driver_id = rides.driver_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create conversation when ride request is approved
DROP TRIGGER IF EXISTS trigger_create_conversation_on_approval ON ride_requests;
CREATE TRIGGER trigger_create_conversation_on_approval
    AFTER UPDATE ON ride_requests
    FOR EACH ROW
    EXECUTE FUNCTION create_conversation_on_approval();

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE (c.driver_id = user_id OR c.passenger_id = user_id)
        AND m.sender_id != user_id
        AND m.is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;

-- Insert some sample data for testing (optional)
-- This will be automatically created when ride requests are approved
