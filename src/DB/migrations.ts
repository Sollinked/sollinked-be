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

    // to do -- calendars
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
];