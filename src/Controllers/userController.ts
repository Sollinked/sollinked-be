import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getDappDomain, getProfilePictureLink, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { User, fillableColumns } from "../Models/user";
import * as userTierController from './userTierController';
import * as mailController from './mailController';
import { changeEmailForwarder, createEmailForwarder } from "../Mail";

const table = 'users';

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
    await createEmailForwarder(filtered.username);

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<User>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    let result = await db.executeQueryForResults<User>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].tiers =  await userTierController.find({'user_id': res.id});
        result[index].mails =  await mailController.find({'user_id': res.id});
        result[index].profile_picture = getProfilePictureLink(result[index].profile_picture);
    }

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<User>(query);

    return result ?? [];
}

// update
export const update = async(id: number, updateParams: {[key: string]: any}): Promise<void> => {
    // filter
    const user = await view(id);
    if(!user) {
        return;
    }

    const filtered = _.pick(updateParams, fillableColumns);

    //update email forwarders if username is different
    if(user.username !== filtered.username) {
        await changeEmailForwarder(filtered.username, user.username);
    }

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
