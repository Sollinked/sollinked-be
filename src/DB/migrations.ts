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
            DROP TRIGGER update_stream_webhooks_updated_at ON stream_webhooks;
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
    {
        name: "add_updated_at_to_mailing_list_broadcasts",
        query: `
            ALTER TABLE mailing_list_broadcasts
            ADD updated_at timestamptz default(current_timestamp);
            CREATE TRIGGER update_mailing_list_broadcasts_updated_at BEFORE UPDATE ON mailing_list_broadcasts FOR EACH ROW EXECUTE PROCEDURE update_at_column();
        `,
        rollback_query: `
            ALTER TABLE mailing_list_broadcasts
            DROP COLUMN updated_at;
            DROP TRIGGER update_mailing_list_broadcasts_updated_at ON mailing_list_broadcasts;
        `,
    },
    {
        name: "add_tier_ids_to_mailing_list_broadcasts",
        query: `
            ALTER TABLE mailing_list_broadcasts
            ADD tier_ids integer[];
        `,
        rollback_query: `
            ALTER TABLE mailing_list_broadcasts
            DROP COLUMN tier_ids;
        `,
    },
    {
        name: "change_timestamps_for_mailing_list_broadcasts",
        query: `
            ALTER TABLE mailing_list_broadcasts
            ALTER COLUMN created_at TYPE timestamptz;
            ALTER TABLE mailing_list_broadcasts
            ALTER COLUMN execute_at TYPE timestamptz;
            ALTER TABLE mailing_list_broadcasts
            ALTER COLUMN execute_at DROP NOT NULL;
            ALTER TABLE mailing_list_broadcasts
            ALTER COLUMN execute_at DROP DEFAULT;
        `,
        rollback_query: `
        ALTER TABLE mailing_list_broadcasts
        ALTER COLUMN created_at TYPE timestamp;
        ALTER TABLE mailing_list_broadcasts
        ALTER COLUMN execute_at TYPE timestamp;
        ALTER TABLE mailing_list_broadcasts
        ALTER COLUMN execute_at SET DEFAULT current_timestamp;
        ALTER TABLE mailing_list_broadcasts
        ALTER COLUMN execute_at SET NOT NULL;
        `,
    },
    
    // add notification to expired emails
    {
        name: "add_sent_message_id_to_mails",
        query: `
            ALTER TABLE mails
            ADD sent_message_id text;
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN sent_message_id;
        `,
    },

    // contents

    {
        name: "create_content_passes_table",
        query: `
            CREATE TABLE content_passes (
                id serial PRIMARY KEY,
                user_id int not null,
                name text not null,
                description text not null,
                amount int default(0) not null,
                value_usd decimal default(0) not null
            )
        `,
        rollback_query: `DROP TABLE content_passes;`,
    },
    {
        name: "create_content_passes_user_id_indexes",
        query: `
            CREATE INDEX content_passes_user_id_idx ON content_passes(user_id);
        `,
        rollback_query: `
            DROP INDEX content_passes_user_id_idx;
        `,
    },

    {
        name: "create_content_cnfts_table",
        query: `
            CREATE TABLE content_cnfts (
                id serial PRIMARY KEY,
                mint_address text, -- null cause will have to update after we get the mint address
                nft_id int, -- underdog nft id
                content_pass_id int not null,
                created_at timestamptz default(current_timestamp) not null
            )
        `,
        rollback_query: `DROP TABLE content_cnfts;`,
    },

    {
        name: "create_content_passes_content_pass_id_indexes",
        query: `
            CREATE INDEX content_passes_content_pass_id_idx ON content_cnfts(content_pass_id);
        `,
        rollback_query: `
            DROP INDEX content_passes_content_pass_id_idx;
        `,
    },

    {
        name: "create_contents_table",
        query: `
            CREATE TYPE content_status AS ENUM ('published', 'draft');
            CREATE TABLE contents (
                id serial PRIMARY KEY,
                user_id int not null,
                content_pass_ids integer[] not null,
                content text not null,
                title text not null,
                slug text not null,
                description text not null,
                value_usd decimal default(-1) not null,
                is_free boolean default(false) not null,
                status content_status default('draft') not null,
                deleted_at timestamp
            )
        `,
        rollback_query: `DROP TABLE contents; DROP TYPE content_status;`,
    },
    
    {
        name: "create_contents_user_id_indexes",
        query: `
            CREATE INDEX contents_user_id_idx ON contents(user_id);
        `,
        rollback_query: `
            DROP INDEX contents_user_id_idx;
        `,
    },

    {
        name: "create_content_comments_table",
        query: `
            CREATE TABLE content_comments (
                id serial PRIMARY KEY,
                user_id int not null,
                content_id int not null,
                reply_to_id int,
                comment text not null,
                created_at timestamptz default(current_timestamp) not null,
                deleted_at timestamp
            )
        `,
        rollback_query: `DROP TABLE content_comments;`,
    },
    
    {
        name: "create_content_comments_content_id_indexes",
        query: `
            CREATE INDEX content_comments_content_id_idx ON content_comments(content_id);
        `,
        rollback_query: `
            DROP INDEX content_comments_content_id_idx;
        `,
    },

    {
        name: "create_content_likes_table",
        query: `
            CREATE TABLE content_likes (
                id serial PRIMARY KEY,
                user_id int not null,
                content_id int not null,
                created_at timestamptz default(current_timestamp) not null
            )
        `,
        rollback_query: `DROP TABLE content_likes;`,
    },
    
    {
        name: "create_content_likes_content_id_indexes",
        query: `
            CREATE INDEX content_likes_content_id_idx ON content_likes(content_id);
        `,
        rollback_query: `
            DROP INDEX content_likes_content_id_idx;
        `,
    },

    {
        name: "create_content_payments_table",
        query: `
            CREATE TYPE content_payment_type AS ENUM ('pass', 'single');
            CREATE TABLE content_payments (
                id serial PRIMARY KEY,
                user_id int not null,
                content_id int not null,
                tx_hash text not null,
                value_usd decimal not null,
                is_processed boolean default(false) not null,
                type content_payment_type not null
            )
        `,
        rollback_query: `
            DROP TABLE content_payments;
            DROP TYPE content_payment_type;
        `,
    },
    
    {
        name: "create_content_payments_content_id_user_id_indexes",
        query: `
            CREATE INDEX content_payments_content_id_user_id_idx ON content_payments(content_id, user_id);
            CREATE INDEX content_payments_is_processed_idx ON content_payments(is_processed);
            CREATE INDEX content_payments_type_idx ON content_payments(type);
        `,
        rollback_query: `
            DROP INDEX content_payments_content_id_user_id_idx;
            DROP INDEX content_payments_is_processed_idx;
            DROP INDEX content_payments_type_idx;
        `,
    },
    {
        name: "add_updated_at_to_contents",
        query: `
            ALTER TABLE contents
            ADD updated_at timestamptz default(current_timestamp);
            CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents FOR EACH ROW EXECUTE PROCEDURE update_at_column();
        `,
        rollback_query: `
            ALTER TABLE contents
            DROP COLUMN updated_at;
            DROP TRIGGER update_contents_updated_at ON contents;
        `,
    },

    // misc updates
    {
        name: "add_created_at_to_users",
        query: `
            ALTER TABLE users
            ADD created_at timestamptz default(current_timestamp);
        `,
        rollback_query: `
            ALTER TABLE users
            DROP COLUMN created_at;
        `,
    },
    {
        name: "add_retry_count_to_mailing_list_broadcast_logs",
        query: `
            ALTER TABLE mailing_list_broadcast_logs
            ADD retry_count int default(0);
        `,
        rollback_query: `
            ALTER TABLE mailing_list_broadcast_logs
            DROP COLUMN retry_count;
        `,
    },

    // fix claimed status
    {
        name: "add_claim_balance_verify_count_to_mails",
        query: `
            ALTER TABLE mails
            ADD claim_balance_verify_count int default(0);
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN claim_balance_verify_count;
        `,
    },

    // user tags

    {
        name: "create_user_tags_table",
        query: `
            CREATE TABLE user_tags (
                id serial PRIMARY KEY,
                user_id int not null,
                name text not null
            )
        `,
        rollback_query: `
            DROP TABLE user_tags;
        `,
    },
    
    {
        name: "create_user_tags_user_id_indexes",
        query: `
            CREATE INDEX user_tags_user_id_idx ON user_tags(user_id);
        `,
        rollback_query: `
            DROP INDEX user_tags_user_id_idx;
        `,
    },

    // add subject to mails 
    {
        name: "add_subject_to_mails",
        query: `
            ALTER TABLE mails
            ADD subject text null;
            `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN subject;
        `
    },
    {
        name: "add_is_from_site_to_mails",
        query: `
            ALTER TABLE mails
            ADD is_from_site boolean default(false) not null;
            `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN is_from_site;
        `
    },

    // for better logging
    {
        name: "create_logs_table",
        query: `
            CREATE TABLE logs (
                id serial PRIMARY KEY,
                created_at timestamp default current_timestamp not null,
                file text not null,
                function text not null,
                log text not null
            );
            CREATE INDEX logs_created_at_idx ON logs(created_at);
        `,
        rollback_query: `
            DROP INDEX logs_created_at_idx;
            DROP TABLE logs;
        `,
    },

    // change address to unique
    {
        name: "add_unique_constraint_to_users_address",
        query: `
            ALTER TABLE users
            ADD CONSTRAINT constraint_unique_address UNIQUE (address);
        `,
        rollback_query: `
            ALTER TABLE users
            DROP CONSTRAINT constraint_unique_address;
        `,
    },

    // to track who sent the mails
    {
        name: "add_from_user_id_to_mails",
        query: `
            ALTER TABLE mails
            ADD from_user_id integer null;
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN from_user_id;
        `,
    },

    // as message cache
    {
        name: "add_message_to_mails",
        query: `
            ALTER TABLE mails
            ADD message text null;

            ALTER TABLE mails
            ADD reply_message text null;
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN message;

            ALTER TABLE mails
            DROP COLUMN reply_message;
        `,
    },

    {
        name: "add_responded_at_to_mails",
        query: `
            ALTER TABLE mails
            ADD responded_at timestamp null;
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN responded_at;
        `,
    },

    // for blogs
    {
        name: "create_content_product_ids_table",
        query: `
            CREATE TABLE content_product_ids (
                id serial PRIMARY KEY,
                user_id integer not null,
                content_product_id text not null
            )
        `,
        rollback_query: `DROP TABLE content_product_ids;`,
    },

    {
        name: "add_paymentlink_id_to_contents",
        query: `
            ALTER TABLE contents
            ADD paymentlink_id text null;
        `,
        rollback_query: `
            ALTER TABLE contents
            DROP COLUMN paymentlink_id;
        `,
    },

    {
        name: "add_paymentlink_id_to_content_passes",
        query: `
            ALTER TABLE content_passes
            ADD paymentlink_id text null;
        `,
        rollback_query: `
            ALTER TABLE content_passes
            DROP COLUMN paymentlink_id;
        `,
    },

    // make sure no double creates
    {
        name: "add_unique_constraint_to_content_payments_tx_hash",
        query: `
            ALTER TABLE content_payments
            ADD CONSTRAINT constraint_unique_tx_hash UNIQUE (tx_hash);
        `,
        rollback_query: `
            ALTER TABLE content_payments
            DROP CONSTRAINT constraint_unique_tx_hash;
        `,
    },

    // add holiday mode
    {
        name: "add_holiday_mode_to_users",
        query: `
            ALTER TABLE users
            ADD holiday_mode boolean not null default(false);
        `,
        rollback_query: `
            ALTER TABLE users
            DROP COLUMN holiday_mode;
        `,
    },

    // Auctions
    {
        name: "create_mail_auctions_table",
        query: `
            CREATE TABLE mail_auctions (
                id serial PRIMARY KEY,
                user_id integer not null,
                start_date timestamp not null, -- timestamp,
                end_date timestamp not null, -- timestamp,
                min_bid decimal(18,2) default(0) not null,
                created_at timestamp default current_timestamp not null,
                deleted_at timestamp null
            );
            CREATE INDEX mail_auctions_user_id_idx ON mail_auctions(user_id);
        `,
        rollback_query: `
            DROP INDEX mail_auctions_user_id_idx;
            DROP TABLE mail_auctions;
        `,
    },
    {
        name: "create_mail_bids_table",
        query: `
            CREATE TABLE mail_bids (
                id serial PRIMARY KEY,
                auction_id integer not null,
                user_id integer not null,
                tiplink_url text not null,
                tiplink_public_key text not null,
                value_usd decimal default(0) not null,
                subject text not null,
                message text not null,
                is_success boolean,
                created_at timestamp default current_timestamp not null,
                updated_at timestamp default current_timestamp not null
            );
            CREATE INDEX mail_bids_user_id_idx ON mail_bids(user_id);
            CREATE INDEX mail_bids_auction_id_idx ON mail_bids(auction_id);
            CREATE TRIGGER update_mail_bids_updated_at BEFORE UPDATE ON mail_bids FOR EACH ROW EXECUTE PROCEDURE update_at_column();
        `,
        rollback_query: `
            DROP TRIGGER update_mail_bids_updated_at ON mail_bids;
            DROP INDEX mail_bids_user_id_idx;
            DROP INDEX mail_bids_auction_id_idx;
            DROP TABLE mail_bids;
        `,
    },

    {
        name: "add_is_auction_to_mails",
        query: `
            ALTER TABLE mails
            ADD is_auction boolean default(false) not null;
        `,
        rollback_query: `
            ALTER TABLE mails
            DROP COLUMN is_auction;
        `,
    },
];