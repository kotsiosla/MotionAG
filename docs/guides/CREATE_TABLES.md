# 🗄️ Δημιουργία Tables στο Supabase

## ❌ Το Πρόβλημα:

Δεν υπάρχουν tables στο database! Το μήνυμα λέει "No tables created yet".

---

## ✅ Λύση: Τρέξε Migrations

### Μέθοδος 1: Με Supabase CLI (Αν έχεις CLI)

```bash
cd C:\Users\kotsi\.cursor\worktrees\chargecyprus\vzj\motionbus
supabase db push
```

### Μέθοδος 2: Με Supabase Dashboard (SQL Editor)

1. **Supabase Dashboard** → **SQL Editor**
2. Copy-paste τον SQL από τα migration files:
   - `supabase/migrations/20260105113119_61faa9c3-e6f1-4ed3-9e96-554f8652a1fd.sql`
   - `supabase/migrations/20260106101206_355c4cd3-b974-4ff4-9152-9088d400cf90.sql`
3. **Run** το SQL

### Μέθοδος 3: Με Supabase AI Assistant

Copy-paste αυτό στο AI Assistant:

```
Create the following tables in the database:

1. push_subscriptions table with columns:
   - id (uuid, primary key)
   - endpoint (text, unique)
   - p256dh (text)
   - auth (text)
   - route_ids (text[])
   - created_at (timestamp)
   - updated_at (timestamp)

2. stop_notification_subscriptions table with columns:
   - id (uuid, primary key)
   - endpoint (text, unique)
   - p256dh (text)
   - auth (text)
   - stop_notifications (jsonb)
   - created_at (timestamp)
   - updated_at (timestamp)

Enable RLS and create policies to allow anyone to insert/update/delete.
```

---

## 📝 SQL για Manual Creation:

Αν θέλεις να το κάνεις manual, copy-paste αυτό στο SQL Editor:

```sql
-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  route_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stop_notification_subscriptions table
CREATE TABLE IF NOT EXISTS public.stop_notification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  stop_notifications JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow anyone to manage)
CREATE POLICY "Anyone can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can manage stop notification subscriptions"
ON public.stop_notification_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);
```

---

## 🧪 Μετά:

1. **Supabase Dashboard** → **Table Editor**
2. Θα πρέπει να βλέπεις:
   - ✅ `push_subscriptions`
   - ✅ `stop_notification_subscriptions`

---

**Τρέξε το SQL και πες μου! 🚀**

