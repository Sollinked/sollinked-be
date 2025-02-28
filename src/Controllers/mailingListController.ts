import { formatDBParamsToStr } from "../../utils";
import DB from "../DB"
import * as mailingListPriceTierController from './mailingListPriceTierController';
import _ from "lodash";
import { MailingList, fillableColumns } from "../Models/mailingList";

const table = 'mailing_lists';

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

    
    const result = await DB.executeQueryForSingleResult<MailingList>(query);

    return result;
}

export const getUserMailingList = async(user_id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE user_id = ${user_id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<MailingList>(query);
    if(!result) {
        return result;
    }

    result.tiers = (await mailingListPriceTierController.find({ mailing_list_id: result.id })) ?? [];
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    const result = await DB.executeQueryForResults<MailingList>(query);

    return result;
}

export const findByUserId = async(user_id: number, onlyActive: boolean = true) => {
    // ignore cancelled
    const query = `SELECT * FROM ${table} WHERE user_id = ${user_id}`;

    
    let result = await DB.executeQueryForSingleResult<MailingList>(query);

    if(!result) {
        return result;
    }

    let params: any = { mailing_list_id: result.id };
    if(onlyActive) {
        params.is_active = true;
    }

    result.tiers = await mailingListPriceTierController.find(params, true);
    return result;
}


// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    
    const result = await DB.executeQueryForResults<MailingList>(query);

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

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     
//     await DB.executeQueryForSingleResult(query);

//     return result;
// }
