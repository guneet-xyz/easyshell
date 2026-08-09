ALTER TABLE "bookmark" ALTER COLUMN "problem_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "problem_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "terminal_session" ALTER COLUMN "problem_id" SET DATA TYPE varchar(64);