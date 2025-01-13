import { formatDBParamsToStr, getInsertQuery, getMailCredentials } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as mailingListBroadcastLogController from './mailingListBroadcastLogController';
import * as userController from './userController';
import { MailingListBroadcast, PastBroadcast, fillableColumns } from "../Models/mailingListBroadcast";
import { sendEmail } from "../Mail";
import moment from 'moment';

const table = 'mailing_list_broadcasts';

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

    if(!result) {
        return;
    }

    return result;
}

export const broadcast = async(broadcast_id: number, emails?: string[]) => {
    if(emails && emails.length > 0) {
        
        let columns = ['mailing_list_broadcast_id', 'to_email'];
        let values: any[] = []; // change test to admin later
        emails.forEach(email => {
            values.push([broadcast_id, email]);
        });

        let insertSubscriberQuery = getInsertQuery(columns, values, 'mailing_list_broadcast_logs');
        await DB.executeQueryForSingleResult(insertSubscriberQuery);
    }
    return;
}

export const createAndBroadcast = async(insertParams: any, emails: string[]) => {
    let res = await create(insertParams);
    if(!res) {
        return;
    }

    await broadcast(res.id, emails);
    return res;
}

export const retryBroadcast = async(broadcast_id: number) => {
    await broadcast(broadcast_id);
    return;
}

export const testDraft = async(broadcast_id: number) => {
    // dont wait
    let credentials = getMailCredentials();

    let broadcast = await view(broadcast_id);
    if(!broadcast) {
        
        await DB.log('mailingListBroadcastController', 'testDraft', 'Missing broadcast object');
        return;
    }

    let user = await userController.view(broadcast.user_id);
    if(!user) {
        
        await DB.log('mailingListBroadcastController', 'testDraft', 'Missing user');
        return;
    }

    if(!user.email_address) {
        
        await DB.log('mailingListBroadcastController', 'testDraft', 'Missing email address');
        return;
    }

    await sendEmail({
        to: user.email_address,
        from: `${user.username}@${credentials.domain}`,
        subject: broadcast.title,
        textAsHtml: broadcast.content,
    });

    return;
}

export const findPastBroadcastsByPriceTierId = async(tier_id: number, user_id: number) => {
    const query = `SELECT 
                        mlb.id,
                        u.id as user_id,
                        username,
                        title,
                        mlb.created_at
                    FROM mailing_list_broadcasts mlb
                    JOIN users u
                    ON u.id = mlb.user_id
                    WHERE (
                            ${Number(tier_id)} = ANY(mlb.tier_ids) OR 
                            -- broadcast has no specific tier
                            (
                                ARRAY_LENGTH(mlb.tier_ids, 1) is null
                                AND mlb.user_id = ${Number(user_id)}
                            )
                        )
                        AND is_draft = false`;
                        
    
    const result = await DB.executeQueryForResults<PastBroadcast>(query);
    if(!result) {
        return [];
    }
    return result;

}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<MailingListBroadcast>(query);
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} order by id desc`;

    
    let results = await DB.executeQueryForResults<MailingListBroadcast>(query);
    if(!results) {
        return results;
    }


    for(const [index, result] of results.entries()) {
        let counts = await mailingListBroadcastLogController.getCount(result.id);
        results[index].success_count = Number(counts?.success_count) ?? 0;
        results[index].total_count = Number(counts?.total_count) ?? 0;
    }

    return results;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    
    const result = await DB.executeQueryForResults<MailingListBroadcast>(query);

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
