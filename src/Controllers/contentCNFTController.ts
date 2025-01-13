import { formatDBParamsToStr, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { ContentCNFT, fillableColumns } from "../Models/contentCNFT";

const table = 'content_cnfts';

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

    
    const result = await DB.executeQueryForSingleResult<ContentCNFT>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    const result = await DB.executeQueryForResults<ContentCNFT>(query);

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY id desc`;

    
    const result = await DB.executeQueryForResults<ContentCNFT>(query);

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

export const deleteById = async(id: number) => {
    const query = `DELETE FROM ${table} WHERE id = ${id}`;

    
    await DB.executeQueryForSingleResult(query);

    return;
}
