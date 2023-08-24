import DB from '../DB';

import { getInsertQuery, getRandomNumber } from '../../utils';
import _ from 'lodash';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env')});

export const seedCraftableSkills = async() => {
    // let db = new DB();
    // let table = 'craftable_skills';
    // let checkerQuery = `SELECT COUNT(*) as count FROM ${table}`;
    // let checkerRes = await db.executeQueryForResults<{count: number}>(checkerQuery);

    // if(checkerRes && checkerRes[0].count > 0) {
    //     console.log(`${table} already seeded! Skipping..`);
    //     return;
    // }

    // let craftableCounterQuery = `SELECT COUNT(*) as count FROM craftables`;
    // let craftableCounterRes = await db.executeQueryForResults<{count: number}>(craftableCounterQuery);

    // if(!craftableCounterRes || craftableCounterRes[0].count === 0) {
    //     console.log(`No craftables detected! Skipping..`);
    //     return;
    // }

    // let columns = ['craftable_id', 'name', 'value'];
    // let values: any[][] = [];
    // let craftableCount = craftableCounterRes[0].count;
    // let skillNames = ['increase_loot_drop', 'increase_catch_rate', 'increase_exp_rate', 'increase_gold_rate'];

    // for(let i = 0; i < craftableCount; i++) {
    //     let craftableId = i + 1; // reference current craftable

    //     let abilityCount = getRandomNumber(1, skillNames.length, true);

    //     for(let j = 0; j < abilityCount; j++) {
    //         let skillIndex = getRandomNumber(0, skillNames.length - 1, true);
    //         let skillName = skillNames[skillIndex]; // can have multiple same abilities
    //         let value = getRandomNumber(MIN_SKILL_VALUE, MAX_SKILL_VALUE);
    //         values.push([craftableId, skillName, value]);
    //     }
    // }

    // let query = getInsertQuery(columns, values, table);
    // try {
    //     await db.executeQuery(query);
    //     console.log(`Seeded ${table}`);
    //     return true;
    // }

    // catch (e){
    //     console.log(e);
    //     return false;
    // }
}