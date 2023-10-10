import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getInsertQuery, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as contentPassController from './contentPassController';
import { Content, ProcessedContent, fillableColumns } from "../Models/content";

const table = 'contents';

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
    const result = await db.executeQueryForSingleResult<Content>(query);

    if(!result) {
        return;
    }

    let processed: ProcessedContent = {
        ...result,
        value_usd: Number(result.value_usd),
    };
    processed.contentPasses = await contentPassController.findByContent(processed.id);
    return processed;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY updated_at desc`;

    const db = new DB();
    const results = await db.executeQueryForResults<Content>(query);
    if(!results) {
        return;
    }

    let processedResults: ProcessedContent[] = [];
    for(const [index, result] of results.entries()) {
        let processed: ProcessedContent = {
            ...result,
            value_usd: parseFloat(result.value_usd ?? '0'),
        };
        processed.contentPasses = await contentPassController.findByContent(processed.id);
        processedResults.push(processed);
    }

    return processedResults;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY updated_at desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<Content>(query);

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