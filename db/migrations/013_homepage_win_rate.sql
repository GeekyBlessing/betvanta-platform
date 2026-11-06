-- Client-confirmed homepage win rate: 75%.
-- Only changes the row while it still holds the original client figure, so an admin edit is never overwritten.
update homepage_stats set value_text = '75%', updated_at = now()
  where key = 'win_rate' and value_text = '100%' and source = 'manual' and verification = 'unverified';
