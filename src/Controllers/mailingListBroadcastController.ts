import { formatDBParamsToStr, getInsertQuery, getMailCredentials } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as mailingListBroadcastLogController from './mailingListBroadcastLogController';
import * as userController from './userController';
import { MailingListBroadcast, fillableColumns } from "../Models/mailingListBroadcast";
import { sendEmail } from "../Mail";
import moment from 'moment';

const table = 'mailing_list_broadcasts';

// init entry for user
export const init = async() => { }

// create
export const create = async(insertParams: any, emails: string[]) => {
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ', ', true);

    // put quote
    const insertColumns = Object.keys(filtered);

    const query = `INSERT INTO ${table} (${_.join(insertColumns, ', ')}) VALUES (${params}) RETURNING id`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<{ id: number }>(query);

    if(!result) {
        return;
    }

    let user = await userController.view(insertParams.user_id);
    if(!user) {
        console.log('Missing user');
        return;
    }

    let columns = ['mailing_list_broadcast_id', 'to_email'];

    let values: any[] = []; // change test to admin later
    emails.forEach(email => {
        values.push([result.id, email]);
    });

    if(values.length === 0){
        return;
    }

    let insertSubscriberQuery = getInsertQuery(columns, values, 'mailing_list_broadcast_logs');
    await db.executeQueryForSingleResult(insertSubscriberQuery);

    return result;
}

export const broadcast = async(broadcast_id: number) => {
    let credentials = getMailCredentials();

    let broadcast = await view(broadcast_id);
    if(!broadcast) {
        console.log("Missing broadcast object");
        return;
    }

    if(broadcast.is_executing) {
        console.log("Broadcast is still ongoing");
        return;
    }
    
    await update(broadcast_id, { is_executing: true });

    let logs = await mailingListBroadcastLogController.find({ mailing_list_broadcast_id: broadcast_id, is_success: false });
    if(!logs || logs.length === 0) {
        console.log("Missing logs");
        return;
    }

    let user = await userController.view(broadcast.user_id);
    if(!user) {
        console.log("Missing user");
        return;
    }
    
    // dont use foreach to prevent spamming the server
    for(const [index, log] of logs.entries()) {
        let isSuccess = await sendEmail({
            to: log.to_email,
            from: `${user.username}@${credentials.domain}`,
            subject: broadcast.title,
            textAsHtml: broadcast.content,
        });

        if(!isSuccess) {
            return;
        }
        await mailingListBroadcastLogController.update(log.id, { is_success: true, success_at: moment().format('YYYY-MM-DDTHH:mm:ssZ') })
    }
    
    await update(broadcast_id, { is_executing: false, executed_at: moment().format('YYYY-MM-DDTHH:mm:ssZ') });
    return;
}

export const createAndBroadcast = async(insertParams: any, emails: string[]) => {
    let res = await create(insertParams, emails);
    if(!res) {
        return;
    }

    // dont wait
    broadcast(res.id);
    return res;
}

export const retryBroadcast = async(broadcast_id: number) => {
    // dont wait
    broadcast(broadcast_id);
    return;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<MailingListBroadcast>(query);
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    let results = await db.executeQueryForResults<MailingListBroadcast>(query);
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

    const db = new DB();
    const result = await db.executeQueryForResults<MailingListBroadcast>(query);

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
