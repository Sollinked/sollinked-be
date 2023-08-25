import DB from '../DB';

import { getInsertQuery } from '../../utils';
import _ from 'lodash';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env')});

export const seedUsers = async() => {
    let db = new DB();
    let table = 'users';
    let checkerQuery = `SELECT COUNT(*) as count FROM ${table}`;
    let checkerRes = await db.executeQueryForResults<{count: number}>(checkerQuery);

    if(checkerRes && checkerRes[0].count > 0) {
        console.log(`${table} already seeded! Skipping..`);
        return;
    }

    let columns = ['address', 'username', 'email_address'];
    let values = [['admin123', 'test', 'admin@email.com']]; // change test to admin later

    let query = getInsertQuery(columns, values, table);
    try {
        await db.executeQuery(query);
        console.log(`Seeded ${table}`);
        return true;
    }

    catch (e){
        console.log(e);
        return false;
    }
}

export const seedUserTiers = async() => {
    let db = new DB();
    let table = 'user_tiers';
    let checkerQuery = `SELECT COUNT(*) as count FROM ${table}`;
    let checkerRes = await db.executeQueryForResults<{count: number}>(checkerQuery);

    if(checkerRes && checkerRes[0].count > 0) {
        console.log(`${table} already seeded! Skipping..`);
        return;
    }

    let columns = ['user_id', 'value_usd', 'respond_days'];
    let values = [[1, 1, 1]];

    let query = getInsertQuery(columns, values, table);
    try {
        await db.executeQuery(query);
        console.log(`Seeded ${table}`);
        return true;
    }

    catch (e){
        console.log(e);
        return false;
    }
}