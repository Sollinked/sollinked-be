import DB from "../DB"
import {
    formatDBParamsToStr,
} from '../../utils';
import _ from "lodash";
import * as userController from '../Controllers/userController';
import axios from 'axios';
import { Webhook, WebhookExecuteParams } from "../Models/webhook";

const table = 'stream_webhooks';

// init entry for user
export const init = async(user_id: number) => {
    await create({
        user_id: user_id,
        status: 'inactive',
        type: 'discord',
        value: '',
        template: '',
    });

    return await create({
        user_id: user_id,
        status: 'inactive',
        type: 'custom',
        value: '',
        template: '',
    });
}

// create
export const create = async(insertParams: any): Promise<{[id: string]: number}> => {
    const db = new DB();

    // get qr insert field
    const fillableColumns = [ 'user_id', 'status', 'value', 'template', 'type' ];
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ', ', true);
    const insertColumns = Object.keys(filtered);

    // insert into qr table
    const query = `INSERT INTO ${table} (${_.join(insertColumns, ', ')}) VALUES (${params}) RETURNING id`;
    const result = await db.executeQueryForSingleResult(query);

    return result;
}

// view (single - id)
export const view = async(id: number): Promise<Webhook> => {
    const query = `SELECT * FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}): Promise<Webhook[]> => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const result: Webhook[] | undefined = await db.executeQueryForResults(query);
    return result as Webhook[] ?? [];
}

// list (all)
export const list = async(): Promise<Webhook[]> => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults(query);

    return result as Webhook[] ?? [];
}

// update
export const update = async(id: number, updateParams: {[key: string]: any}): Promise<void> => {
    // filter
    const fillableColumns = [ 'status', 'value', 'template', 'type' ];
    const filtered = _.pick(updateParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, ', ');

    const query = `UPDATE ${table} SET ${params} WHERE id = ${id}`;

    const db = new DB();
    await db.executeQueryForSingleResult(query);
}

// tests the webhook notification
export const test = async(id: number): Promise<void> => {
    let payer = 'Chad';
    let amount = 99;
    await execute(id, {
        payer,
        amount,
        expiry_date: '2023-08-25 08:00 UTC',
        bcc_to: 'random@email.com',
    });

    await execute(id, {
        payer,
        amount,
        reserve_date: '2023-08-25 08:00 UTC',
        reserve_title: 'Urgent Meeting',
    });
}
export const executeByUserId = async(user_id: number, params: WebhookExecuteParams) => {
    const webhooks = await find({ user_id });
    if(!webhooks) {
        return;
    }

    if(webhooks.length === 0) {
        return;
    }

    let {
        payer,
        amount,
        expiry_date,
        bcc_to,
        reserve_date,
        reserve_title,
    } = params;

    for(const webhook of webhooks) {
        if(!webhook.value) {
            continue;
        }

        if(!webhook.template) {
            continue;
        }

        let message = webhook.template.replace(/{{payer}}/g, payer).replace(/{{amount}}/g, amount.toString());
    
        if(expiry_date && bcc_to) {
            message += `\nPlease reply to ${payer} and bcc the email to ${bcc_to} by ${expiry_date}.`
        }
    
        if(reserve_date) {
            message += `\n${payer} reserved a meeting on ${reserve_date}\n Subject: ${reserve_title? reserve_title : 'No Subject'})`
        }
        await axios.post(webhook.value, { content: message });
    }
} 

export const execute = async(id: number, params: WebhookExecuteParams) => {
    const webhook = await view(id);
    if(!webhook) {
        throw Error("Missing webhook");
    }

    if(!webhook.value) {
        throw Error("Missing webhook");
    }

    if(!webhook.template) {
        throw Error("Empty message");
    }

    let {
        payer,
        amount,
        expiry_date,
        bcc_to,
        reserve_date,
        reserve_title,
    } = params;

    let message = webhook.template.replace(/{{payer}}/g, payer).replace(/{{amount}}/g, amount.toString());

    if(expiry_date && bcc_to) {
        message += `\nPlease reply to ${payer} and bcc the email to ${bcc_to} by ${expiry_date}.`
    }

    if(reserve_date) {
        message += `\nMeeting Date: ${reserve_date}\nSubject: ${reserve_title? reserve_title : 'No Subject'}`
    }

    await axios.post(webhook.value, { content: message });
} 

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     const db = new DB();
//     await db.executeQueryForSingleResult(query);

//     return result;
// }
