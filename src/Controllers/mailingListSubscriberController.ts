import { formatDBParamsToStr } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as mailingListPriceTierController from './mailingListPriceTierController';
import { MailingListSubscriber, fillableColumns } from "../Models/mailingListSubscriber";

const table = 'mailing_list_subscribers';

// init entry for user
export const init = async() => { }

// create
export const create = async(insertParams: any) => {
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, { valueOnly: true });

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
    let result = await db.executeQueryForSingleResult<MailingListSubscriber>(query);
    if(!result) {
        return result;
    }

    result.price_tier = await mailingListPriceTierController.publicView(result.mailing_list_price_tier_id);
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} AND expiry_date >= CURRENT_TIMESTAMP AND is_cancelled = false`;

    const db = new DB();
    let results = await db.executeQueryForResults<MailingListSubscriber>(query);
    if(!results) {
        return results;
    }

    for(const [index, result] of results.entries()) {
        results[index].price_tier = await mailingListPriceTierController.publicView(result.mailing_list_price_tier_id);
    }
    return results;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<MailingListSubscriber>(query);

    return result ?? [];
}

// update
export const update = async(id: number, updateParams: {[key: string]: any}): Promise<void> => {
    // filter
    const filtered = _.pick(updateParams, fillableColumns);
    const params = formatDBParamsToStr(filtered);

    const query = `UPDATE ${table} SET ${params} WHERE id = ${id}`;

    const db = new DB();
    await db.executeQueryForSingleResult(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     const db = new DB();
//     await db.executeQueryForSingleResult(query);

//     return result;
// }
