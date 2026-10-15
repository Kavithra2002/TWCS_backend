-- Extra settings for Executive accounts (General Manager designation, troughs, etc.).
ALTER TABLE "User" ADD COLUMN "user_executive_config" JSONB;
