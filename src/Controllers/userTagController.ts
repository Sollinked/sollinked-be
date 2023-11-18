import { formatDBParamsToStr, getInsertQuery } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { UserTag, fillableColumns } from "../Models/userTag";

const table = 'user_tags';

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
    const result = await db.executeQueryForSingleResult<UserTag>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserTag>(query);

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY id desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserTag>(query);

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

export const updateByUserId = async(user_id: number, tags: string[]): Promise<void> => {
    // filter
    const db = new DB();

    const deleteQuery = `DELETE FROM ${table} WHERE user_id = ${user_id}`;
    await db.executeQuery(deleteQuery);

    let columns = ['user_id', 'name'];
    let values: any[] = []; // change test to admin later
    tags.forEach(tag => {
        values.push([user_id, tag]);
    });

    if(values.length === 0){
        return;
    }

    let query = getInsertQuery(columns, values, table);
    await db.executeQueryForSingleResult(query);
}

export const deleteByUserId = async(user_id: number) => {
    const params = formatDBParamsToStr({ user_id });
    const query = `DELETE FROM ${table} WHERE ${params}`;

    const db = new DB();
    await db.executeQueryForSingleResult(query);

    return;
}
