import { RESERVATION_STATUS_PENDING } from "../Constants";

export default [
    {
        name: "initial_migration",
        query: `
            CREATE TABLE migrations (
                id serial PRIMARY KEY,
                name text UNIQUE not null,
                migration_group int not null,
                migrated_at timestamp not null
            );`,
        rollback_query: `DROP TABLE migrations;`
    },
    {
        name: "create_mails_table",
        query: `
            CREATE TABLE mails (
                id serial PRIMARY KEY,
                user_id int not null,
                from_email text not null,
                to_email text not null,
                bcc_to_email text null,
                message_id text not null,
                tiplink_url text not null,
                tiplink_public_key text not null,
                is_processed bool default(false) not null,
                has_responded bool default(false) not null,
                is_claimed bool default(false) not null,
                created_at timestamp default(current_timestamp) not null,
                processed_at timestamp null,
                value_usd decimal null,
                expiry_date timestamp null
            )
        `,
        rollback_query: `DROP TABLE mails;`,
    },
    {
        name: "create_mail_indexes",
        query: `
            CREATE INDEX mail_from_email_idx ON mails(from_email);
            CREATE INDEX mail_to_email_idx ON mails(to_email);
            CREATE INDEX mail_is_processed_idx ON mails(is_processed);
        `,
        rollback_query: `
            DROP INDEX mail_from_email_idx;
            DROP INDEX mail_to_email_idx;
            DROP INDEX mail_is_processed_idx;
        `,
    },
    {
        name: "create_users_table",
        query: `
            CREATE TABLE users (
                id serial PRIMARY KEY,
                address text not null,
                username text UNIQUE not null,
                profile_picture text null,
                display_name text null,
                email_address text null,
                facebook text null,
                twitter text null,
                twitch text null,
                instagram text null,
                tiktok text null,
                youtube text null,
                calendar_advance_days int default(0) not null
            )
        `,
        rollback_query: `DROP TABLE users;`,
    },
    {
        name: "create_user_tiers_table",
        query: `
            CREATE TABLE user_tiers (
                id serial PRIMARY KEY,
                user_id int not null,
                value_usd decimal not null,
                respond_days int not null
            )
        `,
        rollback_query: `DROP TABLE user_tiers;`,
    },
    {
        name: "create_user_tier_indexes",
        query: `
            CREATE INDEX user_tier_user_id_idx ON user_tiers(user_id);
        `,
        rollback_query: `
            DROP INDEX user_tier_user_id_idx;
        `,
    },

    // calendars
    {
        name: "create_user_reservations_table",
        query: `
            CREATE TABLE user_reservations (
                id serial PRIMARY KEY,
                date timestamp not null,
                user_id int not null,
                reservation_price decimal null, -- for custom reservation prices
                reserve_email text null,
                reserved_at timestamp null,
                reserve_title text null,
                tiplink_url text null,
                tiplink_public_key text null,
                value_usd decimal null,
                status int default(${RESERVATION_STATUS_PENDING}) not null
            )
        `,
        rollback_query: `DROP TABLE user_reservations;`,
    },
    {
        name: "create_user_reservations_indexes",
        query: `
            CREATE INDEX user_reservations_user_id_idx ON user_reservations(user_id);
        `,
        rollback_query: `
            DROP INDEX user_reservations_user_id_idx;
        `,
    },
    {
        name: "create_user_reservation_settings_table",
        query: `
            CREATE TABLE user_reservation_settings (
                id serial PRIMARY KEY,
                user_id int not null,
                day int not null, -- monday to sunday
                hour int not null, -- 0 to 23
                reservation_price decimal not null -- price to reserve this hour
            )
        `,
        rollback_query: `DROP TABLE user_reservation_settings;`,
    },
    {
        name: "create_user_reservation_settings_indexes",
        query: `
            CREATE INDEX user_reservation_settings_user_id_idx ON user_reservation_settings(user_id);
        `,
        rollback_query: `
            DROP INDEX user_reservation_settings_user_id_idx;
        `,
    },

    //webhooks
    {
        // https://stackoverflow.com/questions/9556474/how-do-i-automatically-update-a-timestamp-in-postgresql
        name: "create_updated_at_function",
        query: `
                CREATE OR REPLACE FUNCTION update_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
                    NEW.updated_at = now();
                    RETURN NEW;
                ELSE
                    RETURN OLD;
                END IF;
                END;
                $$ language 'plpgsql';
            `,
        rollback_query: `
            DROP FUNCTION update_at_column;
        `
    },
    {
        name: "create_stream_webhooks_table",
        query: `
            CREATE TYPE webhook_status AS ENUM ('active', 'inactive');
            CREATE TYPE webhook_type AS ENUM ('discord', 'custom');

            CREATE TABLE stream_webhooks (
                id serial PRIMARY KEY,
                user_id int not null,
                type webhook_type not null,
                value text not null,
                template text not null,
                status webhook_status default 'inactive',
                created_at timestamp default current_timestamp,
                updated_at timestamp
            );`,
        rollback_query: `
            DROP TABLE stream_webhooks;
            DROP TYPE webhook_status;
            DROP TYPE webhook_type;
        `
    },
    {
        name: "create_stream_webhooks_idx",
        query: `
            CREATE TRIGGER update_stream_webhooks_updated_at BEFORE UPDATE ON stream_webhooks FOR EACH ROW EXECUTE PROCEDURE update_at_column();
            CREATE INDEX stream_webhook_type_idx ON stream_webhooks (type);
            CREATE INDEX stream_webhook_status_idx ON stream_webhooks (status);
            `,
        rollback_query: `
            DROP TRIGGER update_stream_webhooks_updated_at;
            DROP INDEX stream_webhook_type_idx;
            DROP INDEX stream_webhook_status_idx;
        `
    },
    {
        name: "create_stream_webhooks_concurrently_idx",
        query: `
            CREATE INDEX CONCURRENTLY stream_webhooks_user_id_idx ON stream_webhooks (user_id);
            `,
        rollback_query: `
            DROP INDEX stream_webhooks_user_id_idx;
        `
    },
    {
        name: "add_uuid_to_user_reservations",
        query: `
            ALTER TABLE user_reservations
            ADD uuid text null;
            `,
        rollback_query: `
            ALTER TABLE user_reservations
            DROP COLUMN uuid;
        `
    },
    {
        name: "add_uuid_idx_to_user_reservations",
        query: `
            CREATE INDEX user_reservations_uuid_idx ON user_reservations(uuid);
            `,
        rollback_query: `
            DROP INDEX user_reservations_uuid_idx;
        `
    },

    // github
    {
        name: "create_user_github_settings_table",
        query: `
            CREATE TYPE behavior_type AS ENUM ('mark', 'close');
            CREATE TABLE user_github_settings (
                id serial PRIMARY KEY,
                user_id int not null,
                repo_link text not null,
                uuid text not null,
                last_synced_at timestamp null,
                behavior behavior_type default 'mark' not null,
                is_active bool default false not null
            )
        `,
        rollback_query: `
            DROP TABLE user_github_settings;
            DROP TYPE behavior_type;
        `,
    },
    {
        name: "create_user_github_settings_indexes",
        query: `
            CREATE INDEX user_github_settings_user_id_idx ON user_github_settings(user_id);
        `,
        rollback_query: `
            DROP INDEX user_github_settings_user_id_idx;
        `,
    },

    {
        name: "create_user_github_tiers_table",
        query: `
            CREATE TABLE user_github_tiers (
                id serial PRIMARY KEY,
                user_github_id int not null,
                value_usd decimal not null,
                label text not null,
                color text not null
            )
        `,
        rollback_query: `DROP TABLE user_github_tiers;`,
    },
    {
        name: "create_user_github_tiers_indexes",
        query: `
            CREATE INDEX user_github_tiers_user_github_id_idx ON user_github_tiers(user_github_id);
        `,
        rollback_query: `
            DROP INDEX user_github_tiers_user_github_id_idx;
        `,
    },

    {
        name: "create_user_github_payment_logs_table",
        query: `
            CREATE TABLE user_github_payment_logs (
                id serial PRIMARY KEY,
                user_github_id int not null,
                value_usd decimal null,
                tx_hash text not null,
                from_user text null,
                from_email text not null,
                title text not null,
                body text not null,
                created_at timestamp default current_timestamp not null
            )
        `,
        rollback_query: `DROP TABLE user_github_payment_logs;`,
    },
    {
        name: "create_user_github_payment_logs_indexes",
        query: `
            CREATE INDEX user_github_payment_logs_user_github_id_idx ON user_github_payment_logs(user_github_id);
        `,
        rollback_query: `
            DROP INDEX user_github_payment_logs_user_github_id_idx;
        `,
    },

    {
        name: "create_user_github_whitelists_table",
        query: `
            CREATE TABLE user_github_whitelists (
                id serial PRIMARY KEY,
                user_github_id int not null,
                username text not null
            )
        `,
        rollback_query: `DROP TABLE user_github_whitelists;`,
    },
    {
        name: "create_user_github_whitelists_indexes",
        query: `
            CREATE INDEX user_github_whitelists_user_github_id_idx ON user_github_whitelists(user_github_id);
        `,
        rollback_query: `
            DROP INDEX user_github_whitelists_user_github_id_idx;
        `,
    },
    {
        name: "add_is_verified_to_users",
        query: `
            ALTER TABLE users ADD is_verified boolean default(false) not null;
        `,
        rollback_query: `
            ALTER TABLE users DROP COLUMN is_verified;
        `,
    },

    // mailing lists

    {
        name: "create_mailing_lists_table",
        query: `
            CREATE TABLE mailing_lists (
                id serial PRIMARY KEY,
                user_id int UNIQUE not null, -- only one mailing list per person, tiers will differentiate the product
                product_id text not null, -- product id from sphere, to display in frontend
                wallet_id text not null -- wallet id from sphere, to assign to price list
            )
        `,
        rollback_query: `DROP TABLE mailing_lists;`,
    },
    {
        name: "create_mailing_lists_indexes",
        query: `
            CREATE INDEX mailing_lists_user_id_idx ON mailing_lists(user_id);
        `,
        rollback_query: `
            DROP INDEX mailing_lists_user_id_idx;
        `,
    },
    {
        name: "create_mailing_list_subscribers_table",
        query: `
            CREATE TABLE mailing_list_subscribers (
                id serial PRIMARY KEY,
                mailing_list_price_tier_id int not null,
                user_id int not null,
                price_id text not null, -- subscription id from sphere
                value_usd decimal not null,
                email_address text not null,  -- email address for the subscription
                expiry_date timestamp not null,
                is_cancelled boolean not null default(false)
            )
        `,
        rollback_query: `DROP TABLE mailing_list_subscribers;`,
    },
    {
        name: "create_mailing_list_subscribers_indexes",
        query: `
            CREATE INDEX mailing_list_subscribers_mailing_list_id_idx ON mailing_list_subscribers(mailing_list_price_tier_id);
            CREATE INDEX mailing_list_subscribers_all_idx ON mailing_list_subscribers(mailing_list_price_tier_id, is_cancelled, expiry_date);
        `,
        rollback_query: `
            DROP INDEX mailing_list_subscribers_mailing_list_id_idx;
            DROP INDEX mailing_list_subscribers_all_idx;
        `,
    },
    {
        name: "create_mailing_list_broadcasts_table",
        query: `
            CREATE TABLE mailing_list_broadcasts (
                id serial PRIMARY KEY,
                user_id int not null,
                title text not null,
                content text not null,
                created_at timestamp default(current_timestamp) not null,
                execute_at timestamp default(current_timestamp) not null,
                is_executing boolean not null
            )
        `,
        rollback_query: `DROP TABLE mailing_list_broadcasts;`,
    },
    {
        name: "create_mailing_list_broadcasts_indexes",
        query: `
            CREATE INDEX mailing_list_broadcasts_mailing_list_id_idx ON mailing_list_broadcasts(user_id);
        `,
        rollback_query: `
            DROP INDEX mailing_list_broadcasts_mailing_list_id_idx;
        `,
    },
    {
        name: "create_mailing_list_broadcast_logs_table",
        query: `
            CREATE TABLE mailing_list_broadcast_logs (
                id serial PRIMARY KEY,
                mailing_list_broadcast_id int not null,
                to_email text not null,
                is_success boolean default(false) not null,
                success_at timestamp null,
                log_text text default('') not null
            )
        `,
        rollback_query: `DROP TABLE mailing_list_broadcast_logs;`,
    },
    {
        name: "create_mailing_list_broadcast_logs_indexes",
        query: `
            CREATE INDEX mailing_list_broadcast_logs_mailing_list_broadcast_id_idx ON mailing_list_broadcast_logs(mailing_list_broadcast_id);
        `,
        rollback_query: `
            DROP INDEX mailing_list_broadcast_logs_mailing_list_broadcast_id_idx;
        `,
    },
    {
        name: "create_mailing_list_price_tiers_table",
        query: `
            CREATE TABLE mailing_list_price_tiers (
                id serial PRIMARY KEY,
                mailing_list_id int not null,
                price_id text not null, -- price id from sphere
                paymentlink_id text not null, -- payment link id from sphere for payments
                name text not null,
                description text null,
                amount decimal not null,
                currency text not null,
                charge_every int not null,
                prepay_month int not null,
                is_active boolean not null default(true)
            )
        `,
        rollback_query: `DROP TABLE mailing_list_price_tiers;`,
    },
    {
        name: "create_mailing_list_price_tiers_indexes",
        query: `
            CREATE INDEX mailing_list_price_tiers_mailing_list_id_idx ON mailing_list_price_tiers(mailing_list_id);
        `,
        rollback_query: `
            DROP INDEX mailing_list_price_tiers_mailing_list_id_idx;
        `,
    },
    {
        name: "add_is_draft_to_mailing_list_broadcasts",
        query: `
            ALTER TABLE mailing_list_broadcasts
            ADD is_draft boolean default(false);
        `,
        rollback_query: `
            ALTER TABLE mailing_list_broadcasts
            DROP COLUMN is_draft;
        `,
    },
    
];