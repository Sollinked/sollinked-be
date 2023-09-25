import { formatDBParamsToStr } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as userController from './userController';
import * as mailingListController from './mailingListController';
import * as mailingListSubscriberController from './mailingListSubscriberController';
import { MailingListPriceTier, ProcessedMailingListPriceTier, fillableColumns } from "../Models/mailingListPriceTier";

const table = 'mailing_list_price_tiers';

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
export const view = async(id: number, hideSubcriberCount: boolean = false) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    let result = await db.executeQueryForSingleResult<MailingListPriceTier>(query);
    if(!result) {
        return result;
    }

    if(hideSubcriberCount) {
        result.subscriber_count = -1;
    }

    else {
        result.subscriber_count = (await mailingListSubscriberController.find({ mailing_list_price_tier_id: id }))?.length ?? 0;
    }

    return result;
}

export const publicView = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    let result = await db.executeQueryForSingleResult<MailingListPriceTier>(query);
    if(!result) {
        return result;
    }

    result.subscriber_count = -1;

    let mailingList = await mailingListController.view(result.mailing_list_id);
    if(!mailingList) {
        return;
    }
    let user = await userController.view(mailingList.user_id);
    if(!user) {
        return;
    }

    let processedResult: ProcessedMailingListPriceTier = { ...result, amount: parseFloat(result.amount), username: "" };
    processedResult.username = user.display_name ?? user.username;
    return processedResult;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}, hideSubcriberCount: boolean = false) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const results = await db.executeQueryForResults<MailingListPriceTier>(query);
    if(!results) {
        return [];
    }

    let processedResults: ProcessedMailingListPriceTier[] = [];
    for(const [index, result] of results.entries()) {
        let subscriber_count = hideSubcriberCount? -1 : (await mailingListSubscriberController.find({ mailing_list_price_tier_id: result.id }))?.length ?? 0;
        processedResults.push({
            ...result,
            subscriber_count,
            amount: parseFloat(result.amount ?? '0'),
        })
    }
    
    return processedResults;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<MailingListPriceTier>(query);

    return result ?? [];
}

// update
export const update = async(id: number, updateParams: {[key: string]: any}): Promise<void> => {
    // filter
    const filtered = _.pick(updateParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ', ');

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
