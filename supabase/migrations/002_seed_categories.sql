-- Default categories are created per household when user sets up their first household.
-- This function seeds default categories for a new household.
CREATE OR REPLACE FUNCTION seed_default_categories(p_household_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO categories (household_id, name, icon, color, type, sort_order) VALUES
    -- EXPENSE categories
    (p_household_id, 'Еда и продукты', '🛒', '#22c55e', 'expense', 1),
    (p_household_id, 'Кафе и рестораны', '🍽️', '#f59e0b', 'expense', 2),
    (p_household_id, 'Транспорт', '🚗', '#3b82f6', 'expense', 3),
    (p_household_id, 'ЖКХ и связь', '🏠', '#8b5cf6', 'expense', 4),
    (p_household_id, 'Здоровье', '💊', '#ef4444', 'expense', 5),
    (p_household_id, 'Одежда', '👕', '#ec4899', 'expense', 6),
    (p_household_id, 'Развлечения', '🎬', '#f97316', 'expense', 7),
    (p_household_id, 'Спорт', '⚽', '#14b8a6', 'expense', 8),
    (p_household_id, 'Образование', '📚', '#6366f1', 'expense', 9),
    (p_household_id, 'Путешествия', '✈️', '#0ea5e9', 'expense', 10),
    (p_household_id, 'Подарки', '🎁', '#d946ef', 'expense', 11),
    (p_household_id, 'Прочее', '💳', '#94a3b8', 'expense', 12),
    -- INCOME categories
    (p_household_id, 'Зарплата', '💼', '#22c55e', 'income', 1),
    (p_household_id, 'Фриланс', '💻', '#3b82f6', 'income', 2),
    (p_household_id, 'Инвестиции', '📈', '#f59e0b', 'income', 3),
    (p_household_id, 'Подарки', '🎁', '#d946ef', 'income', 4),
    (p_household_id, 'Прочие доходы', '💰', '#94a3b8', 'income', 5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
