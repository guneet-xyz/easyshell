DROP TABLE "easyshell_account" CASCADE;--> statement-breakpoint
DROP TABLE "easyshell_session" CASCADE;--> statement-breakpoint
DROP TABLE "easyshell_verification_token" CASCADE;--> statement-breakpoint
ALTER TABLE "easyshell_user" DROP COLUMN "email_verified";