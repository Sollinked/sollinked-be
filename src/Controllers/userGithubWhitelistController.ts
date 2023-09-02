import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getInsertQuery, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { UserGithubWhitelist, fillableColumns } from "../Models/UserGithubWhitelist";
import { RESERVATION_STATUS_BLOCKED, RESERVATION_STATUS_CANCELLED } from "../Constants";

const table = 'user_github_whitelists';

// init entry for user
export const init = async() => { }

// create
export const create = async(insertParams: any) => {
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ', ', true);

    // put quote
    const insertColumns = Object.keys(filtered);

    const query = `INSERT INTO ${table} (${_.join(insertColumns, ', ')}) VALUES (${params}) RETURNING id`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<{ id: number }>(query);

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<UserGithubWhitelist>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserGithubWhitelist>(query);

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserGithubWhitelist>(query);

    return result ?? [];
}

// update
export const update = async(user_github_id: number, whitelists: string[]): Promise<void> => {
    // filter
    const db = new DB();

    const deleteQuery = `DELETE FROM ${table} WHERE user_github_id = ${user_github_id}`;
    await db.executeQuery(deleteQuery);

    let columns = ['user_github_id', 'username'];
    let values: any[] = []; // change test to admin later
    whitelists.forEach(whitelist => {
        values.push([user_github_id, whitelist]);
    });

    if(values.length === 0){
        return;
    }

    let query = getInsertQuery(columns, values, table);
    await db.executeQueryForSingleResult(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     const db = new DB();
//     await db.executeQueryForSingleResult(query);

//     return result;
// }
