import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { Mail, fillableColumns } from "../Models/mail";

const table = 'mails';

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
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<Mail>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const filtered = _.pick(whereParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ' AND ');
    const query = `SELECT 
                        id as key,
                        user_id,
                        from_email,
                        to_email,
                        message_id,
                        case 
                        when is_processed then tiplink_url
                        else '' end as tiplink_url,
                        tiplink_public_key,
                        is_processed,
                        has_responded,
                        is_claimed,
                        value_usd,
                        created_at,
                        processed_at,
                        value_usd,
                        expiry_date
                    FROM ${table} 
                    WHERE ${params}`;

    const db = new DB();
    let result = await db.executeQueryForResults<Mail>(query);

    if(!result) {
        return result;
    }

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<Mail>(query);

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
