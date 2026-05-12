-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HOUSEHOLDS
-- ============================================================
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  currency TEXT DEFAULT 'RUB',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HOUSEHOLD MEMBERS
-- ============================================================
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal', 'shared')) DEFAULT 'personal',
  balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'RUB',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#3b82f6',
  type TEXT CHECK (type IN ('income', 'expense')) DEFAULT 'expense',
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'RUB',
  description TEXT NOT NULL DEFAULT '',
  merchant_name TEXT,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense', 'transfer')) DEFAULT 'expense',
  is_shared BOOLEAN DEFAULT FALSE,
  import_source TEXT CHECK (import_source IN ('manual', 'csv', 'pdf')) DEFAULT 'manual',
  import_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE UNIQUE INDEX idx_transactions_import_hash ON transactions(account_id, import_hash) WHERE import_hash IS NOT NULL;

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  period TEXT CHECK (period IN ('monthly', 'yearly')) DEFAULT 'monthly',
  start_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, category_id, period)
);

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC(15,2) NOT NULL,
  current_amount NUMERIC(15,2) DEFAULT 0,
  deadline DATE,
  icon TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);

-- ============================================================
-- PUSH SUBSCRIPTIONS (for web push)
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's household_id
CREATE OR REPLACE FUNCTION get_user_household_id(uid UUID)
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE user_id = uid
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (user_id = auth.uid());

-- HOUSEHOLDS
CREATE POLICY "Household members can read"
  ON households FOR SELECT
  USING (id = get_user_household_id(auth.uid()));

CREATE POLICY "Household admins can update"
  ON households FOR UPDATE
  USING (id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can create household"
  ON households FOR INSERT
  WITH CHECK (TRUE);

-- HOUSEHOLD MEMBERS
CREATE POLICY "Members can read their household members"
  ON household_members FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Admins can manage members"
  ON household_members FOR ALL
  USING (
    household_id = get_user_household_id(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
    )
  );

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ACCOUNTS
CREATE POLICY "Household members can read accounts"
  ON accounts FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users manage own accounts"
  ON accounts FOR INSERT
  WITH CHECK (user_id = auth.uid() AND household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users update own accounts"
  ON accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own accounts"
  ON accounts FOR DELETE
  USING (user_id = auth.uid());

-- CATEGORIES
CREATE POLICY "Household members can read categories"
  ON categories FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Household members can manage categories"
  ON categories FOR ALL
  USING (household_id = get_user_household_id(auth.uid()));

-- TRANSACTIONS
CREATE POLICY "Users can read household transactions"
  ON transactions FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM accounts WHERE household_id = get_user_household_id(auth.uid())
    )
  );

CREATE POLICY "Users insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own transactions"
  ON transactions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own transactions"
  ON transactions FOR DELETE
  USING (user_id = auth.uid());

-- BUDGETS
CREATE POLICY "Household members can read budgets"
  ON budgets FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Household members can manage budgets"
  ON budgets FOR ALL
  USING (household_id = get_user_household_id(auth.uid()));

-- GOALS
CREATE POLICY "Household members can read goals"
  ON goals FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Household members can manage goals"
  ON goals FOR ALL
  USING (household_id = get_user_household_id(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- PUSH SUBSCRIPTIONS
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
