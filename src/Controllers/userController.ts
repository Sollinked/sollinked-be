import { formatDBParamsToStr, getProfilePictureLink, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { HomepageUser, PublicUser, User, fillableColumns } from "../Models/user";
import * as userTierController from './userTierController';
import * as mailController from './mailController';
import * as mailingListController from './mailingListController';
import * as mailingListBroadcastController from './mailingListBroadcastController';
import * as mailingListSubscriberController from './mailingListSubscriberController';
import * as contentController from './contentController';
import * as contentPassController from './contentPassController';
import * as userReservationController from './userReservationController';
import * as userReservationSettingController from './userReservationSettingController';
import * as webhookController from './webhookController';
import * as userGithubSettingController from './userGithubSettingController';
import * as userTagController from './userTagController';
import * as userContentIdController from './contentProductIdController';
import { changeEmailForwarder, createEmailForwarder } from "../Mail";

const table = 'users';

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
    await createEmailForwarder(filtered.username);
    // init webhooks
    await webhookController.init(result!.id);

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<User>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.reservationSettings =  await userReservationSettingController.find({'user_id': id});
    result.tiers = await userTierController.find({ user_id: result.id });
    result.tags = await userTagController.find({ user_id: id });
    result.contentProductId = (await userContentIdController.find({ user_id: result.id }))?.[0] ?? undefined;
    return result;
}

export const viewByUsername = async(username: string) => {
    username = username.replace(/'/g, "''");
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE lower(username) = lower('${username}') LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<User>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.reservationSettings =  await userReservationSettingController.find({ user_id: result.id });
    result.tiers = await userTierController.find({ user_id: result.id });
    result.tags = await userTagController.find({ user_id: result.id });
    result.contentProductId = (await userContentIdController.find({ user_id: result.id }))?.[0] ?? undefined;
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
                        is_verified,
                        holiday_mode
                    FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<PublicUser>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tiers = await userTierController.find({ user_id: id });
    result.tags = await userTagController.find({ user_id: id });
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
                        is_verified,
                        holiday_mode
                    FROM ${table} WHERE lower(username) = lower('${username}') LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<PublicUser>(query);

    if(!result) {
        return result;
    }
    
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tiers = await userTierController.find({ user_id: result.id });
    result.mailingList = await mailingListController.findByUserId(result.id, true);
    result.contentPasses = await contentPassController.find({ user_id: result.id });
    result.contents = await contentController.find({ user_id: result.id, status: "published" }, true);
    result.tags = await userTagController.find({ user_id: result.id });
    return result;
}

// only allow user to find own profile
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', shouldLower: true, isSearch: true });

    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    let result = await DB.executeQueryForResults<User>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].tiers =  await userTierController.find({'user_id': res.id});
        result[index].mails =  await mailController.find({'user_id': res.id});
        result[index].mailingList =  await mailingListController.getUserMailingList(res.id);
        result[index].contentPasses = await contentPassController.find({ user_id: res.id });
        result[index].contents = await contentController.find({ user_id: res.id });
        result[index].broadcasts = await mailingListBroadcastController.find({ user_id: res.id });
        result[index].subscriptions = await mailingListSubscriberController.find({ user_id: res.id });
        result[index].reservations =  await userReservationController.findByUsername(res.id);
        result[index].reservationSettings =  await userReservationSettingController.find({'user_id': res.id});
        result[index].githubSettings = await userGithubSettingController.find({'user_id': res.id});
        result[index].webhooks = await webhookController.find({ user_id: res.id })
        result[index].profile_picture = getProfilePictureLink(result[index].profile_picture);
        result[index].tags = await userTagController.find({ user_id: result[index].id });
        result[index].contentProductId = (await userContentIdController.find({ user_id: result[index].id }))?.[0] ?? undefined;
    }

    return result;
}
// only allow user to find own profile
export const findByAddress = async(address: string) => {
    const params = formatDBParamsToStr({ address }, { separator: ' AND ', shouldLower: true, isSearch: true });

    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    let result = await DB.executeQueryForSingleResult<User>(query);

    if(!result) {
        return result;
    }

    result.tiers =  await userTierController.find({'user_id': result.id});
    result.mails =  await mailController.find({'user_id': result.id});
    result.mailingList =  await mailingListController.getUserMailingList(result.id);
    result.broadcasts = await mailingListBroadcastController.find({ user_id: result.id });
    result.contentPasses = await contentPassController.find({ user_id: result.id });
    result.contents = await contentController.find({ user_id: result.id });
    result.subscriptions = await mailingListSubscriberController.find({ user_id: result.id });
    result.reservations =  await userReservationController.findByUsername(result.id);
    result.reservationSettings =  await userReservationSettingController.find({'user_id': result.id});
    result.githubSettings = await userGithubSettingController.find({'user_id': result.id});
    result.webhooks = await webhookController.find({ user_id: result.id })
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tags = await userTagController.find({ user_id: result.id });
    result.contentProductId = (await userContentIdController.find({ user_id: result.id }))?.[0] ?? undefined;

    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    
    const result = await DB.executeQueryForResults<User>(query);

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

    const params = formatDBParamsToStr(filtered);
    const query = `UPDATE ${table} SET ${params} WHERE id = ${id}`;

    
    return await DB.executeQueryForResults(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     
//     await DB.executeQueryForSingleResult(query);

//     return result;
// }

// public views
export const getHomepageUsers = async() => {
    let query = `
                    with content_joined_payment as (
                        select
                            c.user_id,
                            sum(cp.value_usd) as content_usd
                        from
                            contents c
                        join
                            content_payments cp
                        on
                            c.id = cp.content_id
                        where cp.type = 'single'
                        group by c.user_id
                    ),
                    content_pass_joined_payment as (
                        select
                            c.user_id,
                            sum(cp.value_usd) as content_pass_usd
                        from
                            content_passes c
                        join
                            content_payments cp
                        on
                            c.id = cp.content_id
                        where cp.type = 'pass'
                        group by c.user_id
                    ),
                    mailing_list_joined_payments as (
                        select
                            ml.user_id,
                            sum(mls.value_usd) as mailing_list_usd
                        from
                            mailing_lists ml
                        join
                            mailing_list_price_tiers mlpt
                        on
                            mlpt.mailing_list_id = ml.id
                        join
                            mailing_list_subscribers mls
                        on
                            mls.mailing_list_price_tier_id = mlpt.id
                        group by ml.user_id
                    ),
                    mail_payments as (
                        select
                            user_id,
                            sum(value_usd) as mail_usd
                        from
                            mails
                        where
                            has_responded = true
                        group by user_id
                    ),
                    
                    reservation_payments as (
                        select
                            user_id,
                            sum(value_usd) as reservation_usd
                        from
                            user_reservations
                        where value_usd > 0
                        and status = 2 or status = 3 -- paid and claimed
                        group by user_id
                    ),

                    agg as (
                        select 
                            username,
                            display_name,
                            profile_picture,
                            is_verified,
                            holiday_mode,
                            mail_usd,
                            content_usd,
                            content_pass_usd,
                            mailing_list_usd,
                            reservation_usd,
                            coalesce(mail_usd, 0) + 
                            coalesce(content_usd, 0) +  
                            coalesce(content_pass_usd, 0) + 
                            coalesce(mailing_list_usd, 0) + 
                            coalesce(reservation_usd, 0) as value_usd
                            
                        from users u
                        left join mail_payments m
                        on m.user_id = u.id
                        left join reservation_payments r
                        on r.user_id = u.id
                        left join content_joined_payment c
                        on c.user_id = u.id
                        left join content_pass_joined_payment cp
                        on cp.user_id = u.id
                        left join mailing_list_joined_payments mlp
                        on mlp.user_id = u.id
                        order by value_usd desc
                    )
                    
                    select *
                    from agg
                    where value_usd > 0 or profile_picture is not null or is_verified
                    order by value_usd desc nulls last, is_verified desc, profile_picture desc nulls last
                    limit 50`;

    
    const result = await DB.executeQueryForResults<HomepageUser>(query);

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
                        id,
                        username,
                        display_name,
                        profile_picture,
                        is_verified,
                        holiday_mode
                    from users u
                    where username ilike '%${username}%' or display_name ilike '%${username}%'
                    limit 50`;

    
    const result = await DB.executeQueryForResults<HomepageUser>(query);

    if(!result) {
        return result;
    }

    for(const [index, res] of result.entries()) {
        result[index].value_usd = 0; // dont display
        result[index].profile_picture = getProfilePictureLink(result[index].profile_picture);
        result[index].tags = await userTagController.find({ user_id: result[index].id });
    }

    return result;
}

// dont confuse with find, search is for public use
export const searchAddress = async(address: string) => {
    address = address.replace(/'/g, "''");
    let query = `select 
                        id,
                        username,
                        display_name,
                        profile_picture,
                        is_verified,
                        holiday_mode
                    from users u
                    where address = '${address}'
                    limit 1`;

    
    const result = await DB.executeQueryForSingleResult<HomepageUser>(query);

    if(!result) {
        return result;
    }

    result.value_usd = 0; // dont display
    result.profile_picture = getProfilePictureLink(result.profile_picture);
    result.tags = await userTagController.find({ user_id: result.id });

    return result;
}