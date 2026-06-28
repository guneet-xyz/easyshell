CREATE TYPE "public"."execution_mode" AS ENUM('session', 'submission');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('dispatched', 'accepted', 'running', 'succeeded', 'failed', 'cancelled', 'lost');--> statement-breakpoint
CREATE TYPE "public"."runner_status" AS ENUM('active', 'draining', 'stale', 'deregistered');--> statement-breakpoint
ALTER TYPE "public"."queue_item_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."queue_item_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "easyshell_execution_job" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"container_name" varchar(64) NOT NULL,
	"runner_id" varchar(64) NOT NULL,
	"mode" "execution_mode" NOT NULL,
	"image" varchar(512) NOT NULL,
	"submission_id" integer,
	"testcase_id" integer,
	"terminal_session_id" integer,
	"status" "job_status" DEFAULT 'dispatched' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"last_push_at" timestamp with time zone,
	"last_poll_at" timestamp with time zone,
	"result" jsonb,
	"error_message" text,
	"finished_at" timestamp with time zone,
	CONSTRAINT "easyshell_execution_job_container_name_unique" UNIQUE("container_name")
);
--> statement-breakpoint
CREATE TABLE "easyshell_runner_capability" (
	"runner_id" varchar(64) NOT NULL,
	"mode" "execution_mode" NOT NULL,
	"concurrency" integer NOT NULL,
	CONSTRAINT "easyshell_runner_capability_runner_id_mode_pk" PRIMARY KEY("runner_id","mode")
);
--> statement-breakpoint
CREATE TABLE "easyshell_runner_heartbeat" (
	"runner_id" varchar(64) PRIMARY KEY NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"session_concurrency_used" integer NOT NULL,
	"session_concurrency_max" integer NOT NULL,
	"submission_concurrency_used" integer NOT NULL,
	"submission_concurrency_max" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "easyshell_runner" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"public_url" varchar(2048) NOT NULL,
	"secret_hash" varchar(128) NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"secret_nonce" varchar(64) NOT NULL,
	"status" "runner_status" DEFAULT 'active' NOT NULL,
	"region" varchar(64),
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" varchar(64),
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deregistered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "easyshell_terminal_session_runner" (
	"terminal_session_id" integer PRIMARY KEY NOT NULL,
	"runner_id" varchar(64) NOT NULL,
	"container_name" varchar(64) NOT NULL,
	"execution_job_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "easyshell_terminal_session_runner_container_name_unique" UNIQUE("container_name"),
	CONSTRAINT "easyshell_terminal_session_runner_execution_job_id_unique" UNIQUE("execution_job_id")
);
--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD CONSTRAINT "easyshell_submission_testcase_queue_submission_id_testcase_id_pk" PRIMARY KEY("submission_id","testcase_id");--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD COLUMN "claimed_by" varchar(64);--> statement-breakpoint
ALTER TABLE "easyshell_submission_testcase_queue" ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "easyshell_execution_job" ADD CONSTRAINT "execution_job_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."easyshell_runner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easyshell_runner_capability" ADD CONSTRAINT "runner_capability_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."easyshell_runner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easyshell_runner_heartbeat" ADD CONSTRAINT "runner_heartbeat_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."easyshell_runner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session_runner" ADD CONSTRAINT "terminal_session_runner_session_id_fk" FOREIGN KEY ("terminal_session_id") REFERENCES "public"."easyshell_terminal_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session_runner" ADD CONSTRAINT "terminal_session_runner_runner_id_fk" FOREIGN KEY ("runner_id") REFERENCES "public"."easyshell_runner"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "easyshell_terminal_session_runner" ADD CONSTRAINT "terminal_session_runner_job_id_fk" FOREIGN KEY ("execution_job_id") REFERENCES "public"."easyshell_execution_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_execution_job_runner_status" ON "easyshell_execution_job" USING btree ("runner_id","status");--> statement-breakpoint
CREATE INDEX "idx_execution_job_status_dispatched" ON "easyshell_execution_job" USING btree ("status","dispatched_at");--> statement-breakpoint
CREATE INDEX "idx_runner_status_last_seen" ON "easyshell_runner" USING btree ("status","last_seen_at");