import migrations from './migrations';
import pg, { Client } from 'pg';
import { getDbConfig, getUTCMoment } from '../../utils';

/** Fix big int returning as string */
pg.types.setTypeParser(20, BigInt); // Type Id 20 = BIGINT | BIGSERIAL

export default class DB {

    user: string;
    password: string;
    port: number;
    host: string;
    database: string;

    constructor() {
        let { user, password, port, host, database } = getDbConfig();
        this.user = user;
        this.password = password;
        this.port = port;
        this.host = host;
        this.database = database;
    }

    migrate = async(isInit = false) => {
        let now = getUTCMoment();
        let groupQuery = `
            SELECT name, migration_group FROM migrations ORDER BY migration_group DESC;
        `;
        let groupRes = await this.executeQueryForResults<{ name: string, migration_group: number }>(groupQuery);

        //if is init and group is not null then it's initialized before
        if(isInit && groupRes) {
            console.error('DB was initialized, please use npm run migrate instead');
            return;
        }

        //get group
        let migrationGroup = groupRes && groupRes.length > 0? groupRes[0].migration_group + 1: 1;
        let previousMigrationNames = groupRes? groupRes.map(x => x.name) : [];
        let filteredMigrations = migrations.filter(x => !previousMigrationNames.includes(x.name));

        if(filteredMigrations.length == 0) {
            console.error('Nothing to migrate..');
            return;
        }

        for(let migration of filteredMigrations) {
            let res = await this.executeQuery(migration.query);
            if(res) {
                let logQuery = `INSERT INTO migrations(name, migration_group, migrated_at) VALUES('${migration.name}', ${migrationGroup}, '${now}')`;
                await this.executeQuery(logQuery);
                console.log(`Migrated: ${migration.name}`);
            }

            else {
                console.error(`Unable to migrate: ${migration.name}`);
                break;
            }
        }

        return;
    }

    droptable = async() => {
        const dropQuery = `
            DROP schema public CASCADE;
            CREATE schema public;
        `;

        await this.executeQuery(dropQuery);
    }

    rollback = async() => {
        let rollbackIdQuery = `
            SELECT name FROM migrations
            WHERE migration_group = (SELECT migration_group FROM migrations ORDER BY id DESC LIMIT 1);
        `;
        let rollbackIdQueryRes = await this.executeQueryForResults<{ name: string }>(rollbackIdQuery);

        if(!rollbackIdQueryRes || rollbackIdQueryRes.length === 0) {
            console.error('No migrations found!');
            return;
        }

        //start from the last migration file
        let reversedMigrations = migrations.reverse();
        let rollbackMigrationIds = rollbackIdQueryRes.map(x => x.name);
        let hasStartedRollback = false;

        for(let migration of reversedMigrations) {
            if(hasStartedRollback && !rollbackMigrationIds.includes(migration.name)) {
                // to prevent rollback older migrations
                break;
            }

            else if(!rollbackMigrationIds.includes(migration.name)) {
                // if rollback has not occured and rollback migration ids dont include current migration id
                // ie when there are more migrations since last update but a rollback is called
                continue;
            }

            hasStartedRollback = true;

            try {
                let res = await this.executeQuery(migration.rollback_query);
                if(res) {
                    let logQuery = `DELETE FROM migrations WHERE name = '${migration.name}'`;
                    await this.executeQuery(logQuery);
                    console.log(`Rollbacked: ${migration.name}`);
                }

                else {
                    console.error(`Unable to rollback: ${migration.name}`);
                    break;
                }

            }

            catch {
                if(migration.name === "initial_migration") {
                    //migrations table do not exist
                    console.log(`Rollbacked: ${migration.name}`);
                    break;
                }
                console.error(`Unable to rollback: ${migration.name}`);
                break;
            }
        }

        return;
    }

    executeQuery = async (query: string) => {
        const client = new Client({
            user: this.user,
            password: this.password,
            host: this.host,
            port: this.port,
            database: this.database,
        });
        let isSuccess = false;
        try {
            await client.connect();
            await client.query(query);
            isSuccess = true;
        }

        catch (e){
            console.log(query);
            console.error(e);
        }

        finally {
            await client.end();
            return isSuccess;
        }
    }

    executeQueryForResults = async<T = any>(query: string): Promise<T[] | undefined> => {
        const client = new Client({
            user: this.user,
            password: this.password,
            host: this.host,
            port: this.port,
            database: this.database,
        });

        let res = undefined;
        try {
            await client.connect();
            res = await client.query(query);
        }

        catch (e){
            console.log(query);
            console.error(e);
        }

        finally {
            await client.end();
            if(!res) return res;
            else return res.rows;
        }
    }

    executeQueryForSingleResult = async<T = any>(query: string): Promise<T | undefined> => {
        let rows = await this.executeQueryForResults<T>(query);
        if(!rows || rows.length == 0) {
            return undefined;
        }
        return rows[0];
    }
}