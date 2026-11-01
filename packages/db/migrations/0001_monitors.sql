CREATE TABLE `monitor_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`monitor_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status_code` integer,
	`response_time_ms` integer,
	`is_success` integer NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_logs_monitor_created_idx` ON `monitor_logs` (`monitor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `monitor_logs_user_created_idx` ON `monitor_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`method` text DEFAULT 'GET' NOT NULL,
	`url` text NOT NULL,
	`headers` text DEFAULT '{}',
	`body` text,
	`interval_seconds` integer DEFAULT 60 NOT NULL,
	`timeout_ms` integer DEFAULT 10000 NOT NULL,
	`expected_status` integer,
	`is_enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitors_user_idx` ON `monitors` (`user_id`);