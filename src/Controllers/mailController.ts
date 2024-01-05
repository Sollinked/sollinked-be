import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { Mail, ProcessedMail, fillableColumns } from "../Models/mail";
import moment from 'moment';

const table = 'mails';

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
    const result = await db.executeQueryForSingleResult<Mail>(query);
    if(!result) {
        return undefined;
    }
    let processedResult: ProcessedMail = {
        ...result,
        value_usd: parseFloat(result.value_usd ?? '0'),
    }
    return processedResult;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}, createdAfter?: string, onlyFromSMTP?: boolean) => {
    const filtered = _.pick(whereParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, { separator: ' AND ', isSearch: true });
    const query = `SELECT 
                        id as key,
                        user_id,
                        from_email,
                        to_email,
                        bcc_to_email,
                        message_id,
                        case 
                        when is_processed then tiplink_url
                        else '' end as tiplink_url,
                        tiplink_public_key,
                        is_processed,
                        has_responded,
                        is_claimed,
                        coalesce(value_usd, 0) as value_usd,
                        created_at,
                        processed_at,
                        expiry_date,
                        subject,
                        is_from_site
                    FROM ${table} 
                    WHERE ${params}
                    ${createdAfter? `AND created_at >= '${createdAfter}'` : ""}
                    ${onlyFromSMTP? `AND is_from_site = false` : ""}
                    AND (CASE WHEN message_id = 'from site' AND bcc_to_email is null then false else true end)`;

    const db = new DB();
    let results = await db.executeQueryForResults<Mail>(query);

    if(!results) {
        return results;
    }

    let processedResults: ProcessedMail[] = [];
    for(const [index, result] of results.entries()) {
        processedResults.push({
            ...result,
            value_usd: parseFloat(result.value_usd ?? '0'),
        })
    }

    return processedResults;
}
// find (all match)
export const getExpired = async() => {
    const query = `SELECT 
                        id as key,
                        user_id,
                        from_email,
                        to_email,
                        bcc_to_email,
                        message_id,
                        case 
                        when is_processed then tiplink_url
                        else '' end as tiplink_url,
                        tiplink_public_key,
                        is_processed,
                        has_responded,
                        is_claimed,
                        coalesce(value_usd, 0) as value_usd,
                        created_at,
                        processed_at,
                        expiry_date,
                        sent_message_id,
                        subject,
                        is_from_site
                    FROM ${table} 
                    WHERE 
                        value_usd > 0 
                        AND value_usd is not null
                        AND has_responded = false
                        AND expiry_date < '${moment().format('YYYY-MM-DDTHH:mm:ssZ')}'`;

    const db = new DB();
    let results = await db.executeQueryForResults<Mail>(query);

    if(!results) {
        return results;
    }

    let processedResults: ProcessedMail[] = [];
    for(const [index, result] of results.entries()) {
        processedResults.push({
            ...result,
            value_usd: parseFloat(result.value_usd ?? '0'),
        })
    }

    return processedResults;
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
