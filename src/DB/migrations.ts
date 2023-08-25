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
                profile_id int not null,
                from_email text not null,
                to_email text not null,
                message_id text not null,
                tiplink_url text not null,
                tiplink_public_key text not null,
                is_processed bool default(false) not null,
                has_responded bool default(false) not null,
                created_at timestamp default(current_timestamp) not null
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
        name: "create_profiles_table",
        query: `
            CREATE TABLE profiles (
                id serial PRIMARY KEY,
                address text not null,
                username text UNIQUE not null,
                email_address text null
            )
        `,
        rollback_query: `DROP TABLE profiles;`,
    },
    {
        name: "create_profile_tiers_table",
        query: `
            CREATE TABLE profile_tiers (
                id serial PRIMARY KEY,
                profile_id int not null,
                value_usd decimal not null,
                respond_days int not null
            )
        `,
        rollback_query: `DROP TABLE profile_tiers;`,
    },
    {
        name: "create_profile_tier_indexes",
        query: `
            CREATE INDEX profile_tier_profile_id_idx ON profile_tiers(profile_id);
        `,
        rollback_query: `
            DROP INDEX profile_tier_profile_id_idx;
        `,
    },
    {
        name: "create_payments_table",
        query: `
            CREATE TABLE payments (
                id serial PRIMARY KEY,
                mail_id int not null,
                created_at timestamp default(current_timestamp) not null
            )
        `,
        rollback_query: `DROP TABLE payments;`,
    },

    // to do -- calendars
];