import { formatDBParamsToStr } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { MailingListBroadcastLog, fillableColumns } from "../Models/mailingListBroadcastLog";

const table = 'mailing_list_broadcast_logs';

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

    
    const result = await DB.executeQueryForSingleResult<MailingListBroadcastLog>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    const result = await DB.executeQueryForResults<MailingListBroadcastLog>(query);

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    
    const result = await DB.executeQueryForResults<MailingListBroadcastLog>(query);

    return result ?? [];
}

// update
export const update = async(id: number, updateParams: {[key: string]: any}): Promise<void> => {
    // filter
    const filtered = _.pick(updateParams, fillableColumns);
    const params = formatDBParamsToStr(filtered);

    const query = `UPDATE ${table} SET ${params} WHERE id = ${id}`;

    
    await DB.executeQueryForSingleResult(query);
}

export const getCount = async(broadcast_id: number) => {
    const query = `SELECT count(*)::int as total_count, count(is_success or null)::int as success_count FROM ${table} WHERE mailing_list_broadcast_id = ${broadcast_id}`;

    
    const result = await DB.executeQueryForSingleResult<{ total_count: number, success_count: number }>(query);
    return result;
}


export const getUniquePendingBroadcastIds = async() => {
    const query = `SELECT distinct mailing_list_broadcast_id FROM ${table} WHERE is_success = false`;

    
    const result = await DB.executeQueryForResults<{ mailing_list_broadcast_id: number }>(query);
    return result;
}


export const getDistinctEmailsForBroadcastId = async(broadcast_id: number) => {
    const query = `SELECT distinct min(id) as id, to_email, MAX(retry_count) as retry_count FROM ${table} WHERE is_success = false AND retry_count < 3 AND mailing_list_broadcast_id = ${broadcast_id} GROUP BY to_email`;

    
    const result = await DB.executeQueryForResults<{ id: number, to_email: string, retry_count: number }>(query);
    return result;
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     
//     await DB.executeQueryForSingleResult(query);

//     return result;
// }
