import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getDappDomain, getProfilePictureLink, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { HomepageUser, PublicUser, User, fillableColumns } from "../Models/user";
import * as userTierController from './userTierController';
import * as mailController from './mailController';
import * as mailingListController from './mailingListController';
import * as userReservationController from './userReservationController';
import * as userReservationSettingController from './userReservationSettingController';
import * as webhookController from './webhookController';
import * as userGithubSettingController from './userGithubSettingController';
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
    // init webhooks
    await webhookController.init(result!.id);

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
    result.reservationSettings =  await userReservationSettingController.find({'user_id': id});
    return result;
}

export const viewByUsername = async(username: string) => {
    username = username.replace(/'/g, "''");
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE lower(username) = lower('${username}') LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<User>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.reservationSettings =  await userReservationSettingController.find({ user_id: result.id });
    result.tiers = await userTierController.find({ user_id: result.id });
    return result;
}

// view (single - id) for public profile
export const publicView = async(id: number) => {
    // username: string;
    // display_name: string;
    // profile_picture: string;
    // facebook: string;
    // instagram: string;
    // twitter: string;
    // twitch: string;
    // tiktok: string;
    // youtube: string;
    // tiers?: UserTier[];
    const query = `SELECT 
                        id,
                        username,
                        display_name,
                        profile_picture,
                        facebook,
                        instagram,
                        twitter,
                        twitch,
                        tiktok,
                        youtube,
                        is_verified
                    FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<PublicUser>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tiers = await userTierController.find({ user_id: id });
    return result;
}

// view (single - id) for public profile
export const publicViewByUsername = async(username: string) => {
    // username: string;
    // display_name: string;
    // profile_picture: string;
    // facebook: string;
    // instagram: string;
    // twitter: string;
    // twitch: string;
    // tiktok: string;
    // youtube: string;
    // tiers?: UserTier[];
    const query = `SELECT 
                        id,
                        username,
                        display_name,
                        profile_picture,
                        facebook,
                        instagram,
                        twitter,
                        twitch,
                        tiktok,
                        youtube,
                        is_verified
                    FROM ${table} WHERE lower(username) = loweR('${username}') LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<PublicUser>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tiers = await userTierController.find({ user_id: result.id });
    return result;
}

// only allow user to find own profile
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ', false, "", true);

    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    let result = await db.executeQueryForResults<User>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].tiers =  await userTierController.find({'user_id': res.id});
        result[index].mails =  await mailController.find({'user_id': res.id});
        result[index].mailingList =  await mailingListController.getUserMailingList(res.id);
        result[index].reservations =  await userReservationController.findByUsername(res.id);
        result[index].reservationSettings =  await userReservationSettingController.find({'user_id': res.id});
        result[index].githubSettings = await userGithubSettingController.find({'user_id': res.id});
        result[index].webhooks = await webhookController.find({ user_id: res.id })
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
export const update = async(id: number, updateParams: {[key: string]: any}) => {
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
    return await db.executeQueryForResults(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     const db = new DB();
//     await db.executeQueryForSingleResult(query);

//     return result;
// }

// public views
export const getHomepageUsers = async() => {
    let query = `select 
                        username,
                        display_name,
                        profile_picture,
                        is_verified,
                        sum(coalesce(m.value_usd, 0)) + sum(coalesce(r.value_usd, 0)) as value_usd
                    from users u
                    left join mails m
                    on m.user_id = u.id
                    left join user_reservations r
                    on r.user_id = u.id
                    group by 1,2,3,4
                    having sum(coalesce(m.value_usd, 0)) + sum(coalesce(r.value_usd, 0)) > 0 or profile_picture is not null or is_verified
                    order by value_usd desc nulls last, profile_picture desc nulls last
                    limit 50`;

    const db = new DB();
    const result = await db.executeQueryForResults<HomepageUser>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].value_usd = 0; // dont display
        result[index].profile_picture = getProfilePictureLink(result[index].profile_picture);
    }

    return result;
}

// dont confuse with find, search is for public use
export const search = async(username: string) => {
    username = username.replace(/'/g, "''");
    let query = `select 
                        username,
                        display_name,
                        profile_picture,
                        is_verified
                    from users u
                    where username ilike '%${username}%' or display_name ilike '%${username}%'
                    limit 50`;

    const db = new DB();
    const result = await db.executeQueryForResults<HomepageUser>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].value_usd = 0; // dont display
        result[index].profile_picture = getProfilePictureLink(result[index].profile_picture);
    }

    return result;
}