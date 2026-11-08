-- execution_job.runner_id is NOT NULL with a FK to easyshell_runner; the
-- coordinator inserts jobs with runner_id 'unassigned' until a runner accepts
-- them. This row satisfies the FK. It is deregistered, revoked and has no
-- usable secret, so it is never dispatched to or authenticated as.
INSERT INTO "easyshell_runner" ("id", "name", "public_url", "secret_hash", "secret_ciphertext", "secret_nonce", "status", "deregistered_at", "revoked_at")
VALUES ('unassigned', 'unassigned (sentinel)', 'http://unassigned.invalid', '!', '', '', 'deregistered', now(), now())
ON CONFLICT ("id") DO NOTHING;
