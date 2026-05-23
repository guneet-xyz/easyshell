ALTER TABLE "easyshell_submissions" ADD COLUMN "runtime" varchar(32);--> statement-breakpoint
ALTER TABLE "easyshell_submissions" ADD COLUMN "namespace" varchar(255);--> statement-breakpoint
ALTER TABLE "easyshell_submissions" ADD COLUMN "job_name" varchar(255);--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session" ADD COLUMN "pod_name" varchar(255);--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session" ADD COLUMN "namespace" varchar(255);--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session" ADD COLUMN "runtime" varchar(32);