-- Add share_code to answer_keys
ALTER TABLE answer_keys ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_answer_keys_share_code ON answer_keys(share_code);
