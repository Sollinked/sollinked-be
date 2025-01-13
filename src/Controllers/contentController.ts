import { formatDBParamsToStr, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as contentPassController from './contentPassController';
import { Content, ProcessedContent, ProcessedContentWithUser, fillableColumns } from "../Models/content";

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

    
    const result = await DB.executeQueryForSingleResult<{ id: number }>(query);

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<Content>(query);

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
export const find = async(whereParams: {[key: string]: any}, shouldHide: boolean = false) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY updated_at desc`;

    
    const results = await DB.executeQueryForResults<Content>(query);
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
        if(shouldHide) {
            processed.content = "";
        }
        processedResults.push(processed);
    }

    return processedResults;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY updated_at desc`;

    
    const results = await DB.executeQueryForResults<Content>(query);
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
        processed.content = ""; // hide it
        processedResults.push(processed);
    }

    return processedResults;
}

// list (all)
export const getLatest = async(top: number) => {
    const query = `SELECT * FROM ${table} where status = 'published' ORDER BY updated_at desc`;

    
    const results = await DB.executeQueryForResults<Content>(query);
    if(!results) {
        return;
    }

    let processedResults: ProcessedContentWithUser[] = [];
    for(const [index, result] of results.entries()) {
        const userQuery = `SELECT username, display_name FROM users where id = ${result.user_id}`;
        const user = await DB.executeQueryForSingleResult<{ username: string, display_name: string }>(userQuery);
        let processed: ProcessedContentWithUser = {
            ...result,
            value_usd: parseFloat(result.value_usd ?? '0'),
        };
        processed.contentPasses = await contentPassController.findByContent(processed.id);
        processed.content = ""; // hide it
        processed.user = user;
        processedResults.push(processed);
    }

    return processedResults;
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
