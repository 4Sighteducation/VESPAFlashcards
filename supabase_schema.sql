CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to Supabase auth.users table
    email TEXT, -- Can be synced from auth.users or stored here if needed for quick joins
    full_name TEXT,
    -- Add any other user-specific fields that are NOT part of the core flashcard data
    -- e.g., subscription_status, preferences, etc.
    knack_user_record_id TEXT UNIQUE, -- Store the original Knack record ID for mapping/migration (optional, but useful during transition)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) - CRITICAL for Supabase
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own profile.
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own profile.
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Note: You might not need INSERT policy if profiles are created via a trigger on auth.users creation.
-- Or, if users can create their own profile entry after sign-up:
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Maths", "Physics"
    color TEXT, -- From your current colorMapping
    -- Any other metadata specific to a subject from topicMetadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, name) -- A user shouldn't have two subjects with the same name
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subjects"
ON public.subjects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- For easier RLS and queries
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Algebra"
    -- Any metadata specific to a topic (e.g., from topicMetadata)
    -- For example: difficulty, syllabus_reference, etc.
    metadata JSONB, -- Flexible store for other topic-specific details
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (subject_id, name) -- A subject shouldn't have two topics with the same name
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own topics"
ON public.topics FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    question_type TEXT, -- e.g., 'multiple_choice', 'short_answer', 'acronym'
    options JSONB, -- For multiple choice questions (array of strings)
    -- any other card-specific fields like hints, image_url, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own flashcards"
ON public.flashcards FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_box_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    box_number INT NOT NULL CHECK (box_number >= 1 AND box_number <= 5), -- Assuming 5 boxes
    added_at TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    UNIQUE (user_id, flashcard_id) -- A card should only be in one box at a time for a user
);

ALTER TABLE public.study_box_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own study box entries"
ON public.study_box_entries FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for querying cards due for review
CREATE INDEX idx_study_box_entries_next_review ON public.study_box_entries(user_id, next_review_at);

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers for 'updated_at'
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_topics_updated_at
BEFORE UPDATE ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_study_box_entries_updated_at
BEFORE UPDATE ON public.study_box_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column(); 