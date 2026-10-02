-- Account columns use the names the user register is stored under.
ALTER TABLE "User" RENAME COLUMN "id" TO "user_id";
ALTER TABLE "User" RENAME COLUMN "name" TO "user_name";
ALTER TABLE "User" RENAME COLUMN "email" TO "user_email";
ALTER TABLE "User" RENAME COLUMN "passwordHash" TO "user_password";
ALTER TABLE "User" RENAME COLUMN "createdAt" TO "user_created_date";
ALTER TABLE "User" RENAME COLUMN "updatedAt" TO "user_updated_date";

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "User" RENAME COLUMN "role" TO "user_role";
ALTER TABLE "User" ALTER COLUMN "user_role" SET DEFAULT 'super_admin';

DROP TYPE "Role";
