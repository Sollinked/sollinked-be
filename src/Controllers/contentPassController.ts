import { formatDBParamsToStr, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as contentCNFTController from './contentCNFTController';
import { ContentPass, ProcessedContentPass, fillableColumns } from "../Models/contentPass";

const table = 'content_passes';

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
    const result = await db.executeQueryForSingleResult<ContentPass>(query);
    if(!result) {
        return;
    }

    let processed: ProcessedContentPass = {
        ...result,
        value_usd: Number(result.value_usd),
    }
    let cnfts = await contentCNFTController.find({ content_pass_id: id });
    processed.cnft_count = cnfts?.length ?? 0;
    return processed;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY id desc`;

    const db = new DB();
    const results = await db.executeQueryForResults<ContentPass>(query);

    if(!results) {
        return;
    }

    let processedResults: ProcessedContentPass[] = [];
    for(const [index, result] of results.entries()) {
        let processed: ProcessedContentPass = {
            ...result,
            value_usd: Number(result.value_usd),
        }
        let cnfts = await contentCNFTController.find({ content_pass_id: result.id });
        processed.cnft_count = cnfts?.length ?? 0;
        processedResults.push(processed);
    }

    return processedResults;
}

// to append to content
export const findByContent = async(content_id: number) => {
    const query = `
        SELECT 
            cp.*,
            sum(case when cc.id is not null then 1 else 0 end)::integer as cnft_count
        FROM content_passes cp
        JOIN contents c
        ON cp.id = ANY(c.content_pass_ids)
        LEFT JOIN content_cnfts cc
        ON cc.content_pass_id = cp.id
        WHERE c.id = ${content_id}
        GROUP BY cp.id
        -- HAVING amount >= sum(case when cc.id is not null then 1 else 0 end)
    `;

    const db = new DB();
    const results = await db.executeQueryForResults<ContentPass>(query);

    if(!results) {
        return;
    }

    let processedResults: ProcessedContentPass[] = [];
    for(const [index, result] of results.entries()) {
        processedResults.push({
            ...result,
            value_usd: parseFloat(result.value_usd ?? '0'),
        });
    }

    return processedResults;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY id desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<ContentPass>(query);

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
