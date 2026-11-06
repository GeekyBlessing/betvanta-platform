-- Client-provided homepage figures, as confirmed: 2,000 Happy Members and 12,500 Winning Picks (no "+").
-- Only touches rows still holding the original seed values, so anything an admin has edited is left alone.
update homepage_stats set value_text = '2,000', updated_at = now()
  where key = 'members' and value_text = '2,000+' and source = 'manual' and verification = 'unverified';
update homepage_stats set value_text = '12,500', updated_at = now()
  where key = 'winning_picks' and value_text = '12,500+' and source = 'manual' and verification = 'unverified';
