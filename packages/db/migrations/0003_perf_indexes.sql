CREATE INDEX `account_user_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `collection_folders_collection_idx` ON `collection_folders` (`collection_id`);--> statement-breakpoint
CREATE INDEX `collections_user_idx` ON `collections` (`user_id`);--> statement-breakpoint
CREATE INDEX `environment_variables_env_idx` ON `environment_variables` (`environment_id`);--> statement-breakpoint
CREATE INDEX `environments_user_idx` ON `environments` (`user_id`);--> statement-breakpoint
CREATE INDEX `request_headers_request_idx` ON `request_headers` (`request_id`);--> statement-breakpoint
CREATE INDEX `request_history_user_created_idx` ON `request_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `request_history_request_idx` ON `request_history` (`request_id`);--> statement-breakpoint
CREATE INDEX `requests_user_idx` ON `requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `requests_collection_idx` ON `requests` (`collection_id`);--> statement-breakpoint
CREATE INDEX `requests_folder_idx` ON `requests` (`folder_id`);--> statement-breakpoint
CREATE INDEX `schedule_logs_schedule_created_idx` ON `schedule_logs` (`schedule_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `schedules_user_idx` ON `schedules` (`user_id`);--> statement-breakpoint
CREATE INDEX `schedules_request_idx` ON `schedules` (`request_id`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);