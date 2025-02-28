import { formatDBParamsToStr, getInsertQuery, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { UserTier, fillableColumns } from "../Models/userTier";

const table = 'user_tiers';

// init entry for user
export const init = async() => { }

// create
export const create = async(insertParams: any) => {
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, { valueOnly: true });

    // put quote
    const insertColumns = Object.keys(filtered);

    const query = `INSERT INTO ${table} (${_.join(insertColumns, ', ')}) VALUES (${params}) RETURNING id`;

    
    const result = await DB.executeQueryForSingleResult<{ id: number }>(query);

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<UserTier>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY value_usd desc`;

    
    const result = await DB.executeQueryForResults<UserTier>(query);

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY value_usd desc`;

    
    const result = await DB.executeQueryForResults<UserTier>(query);

    return result ?? [];
}

// update
export const update = async(user_id: number, tiers: UserTier[]): Promise<void> => {
    // filter
    

    const deleteQuery = `DELETE FROM ${table} WHERE user_id = ${user_id}`;
    await DB.executeQuery(deleteQuery);

    let columns = ['user_id', 'value_usd', 'respond_days'];
    let values: any[] = []; // change test to admin later
    tiers.forEach(tier => {
        values.push([user_id, tier.value_usd, tier.respond_days]);
    });

    if(values.length === 0){
        return;
    }

    let query = getInsertQuery(columns, values, table);
    await DB.executeQueryForSingleResult(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     
//     await DB.executeQueryForSingleResult(query);

//     return result;
// }
