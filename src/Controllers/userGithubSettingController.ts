import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getInsertQuery, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import * as userGithubWhitelistController from './userGithubWhitelistController';
import * as userGithubTierController from './userGithubTierController';
import * as userGithubPaymentLogController from './userGithubPaymentLogController';
import { UserGithubSetting, fillableColumns } from "../Models/userGithubSetting";
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

const table = 'user_github_settings';

// init entry for user
export const init = async() => { }

// create
export const create = async(insertParams: any) => {
    let uuid = uuidv4();
    insertParams.uuid = uuid;
    const filtered = _.pick(insertParams, fillableColumns);
    const params = formatDBParamsToStr(filtered, { valueOnly: true });

    // put quote
    const insertColumns = Object.keys(filtered);

    const query = `INSERT INTO ${table} (${_.join(insertColumns, ', ')}) VALUES (${params}) RETURNING id`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<{ id: number }>(query);

    return uuid;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    const db = new DB();
    const result = await db.executeQueryForSingleResult<UserGithubSetting>(query);
    if(!result) {
        return result;
    }

    // let whitelistRes = await userGithubWhitelistController.find({ user_github_id: result.id });
    // result.whitelists = whitelistRes? whitelistRes.map(x => x.username) : [];
    let tierRes = await userGithubTierController.find({ user_github_id: result.id });
    result.tiers = tierRes? tierRes : [];
    // let logRes = await userGithubPaymentLogController.find({ user_github_id: result.id });
    // result.logs = logRes? logRes : [];

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', shouldLower: true, isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const results = await db.executeQueryForResults<UserGithubSetting>(query);

    if(!results) {
        return results;
    }

    for(const [index, result] of results.entries()) {
        let whitelistRes = await userGithubWhitelistController.find({ user_github_id: result.id });
        results[index].whitelists = whitelistRes? whitelistRes.map(x => x.username) : [];
        let tierRes = await userGithubTierController.find({ user_github_id: result.id });
        results[index].tiers = tierRes? tierRes : [];
        let logRes = await userGithubPaymentLogController.find({ user_github_id: result.id });
        results[index].logs = logRes? logRes : [];
    }

    return results;
}

// find (all match)
export const findActiveSynced = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', shouldLower: true, isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} AND is_active = true AND last_synced_at is not null;`;

    const db = new DB();
    const results = await db.executeQueryForResults<UserGithubSetting>(query);

    if(!results) {
        return results;
    }

    for(const [index, result] of results.entries()) {
        let whitelistRes = await userGithubWhitelistController.find({ user_github_id: result.id });
        results[index].whitelists = whitelistRes? whitelistRes.map(x => x.username) : [];
        let tierRes = await userGithubTierController.find({ user_github_id: result.id });
        results[index].tiers = tierRes? tierRes : [];
        let logRes = await userGithubPaymentLogController.find({ user_github_id: result.id });
        results[index].logs = logRes? logRes : [];
    }

    return results;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} WHERE is_active = true`;

    const db = new DB();
    const results = await db.executeQueryForResults<UserGithubSetting>(query);

    if(!results) {
        return results;
    }

    for(const [index, result] of results.entries()) {
        let whitelistRes = await userGithubWhitelistController.find({ user_github_id: result.id });
        results[index].whitelists = whitelistRes? whitelistRes.map(x => x.username) : [];
        let tierRes = await userGithubTierController.find({ user_github_id: result.id });
        results[index].tiers = tierRes? tierRes : [];
        let logRes = await userGithubPaymentLogController.find({ user_github_id: result.id });
        results[index].logs = logRes? logRes : [];
    }

    return results;
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

export const updateLastSynced = async(id: number): Promise<void> => {
    // filter
    const query = `UPDATE ${table} SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

    const db = new DB();
    await db.executeQueryForSingleResult(query);
}

// delete (soft delete?)
export const deleteDuplicate = async() => {
    const query = `
        DELETE FROM ${table} 
        WHERE 
            repo_link in (
                SELECT repo_link from ${table} WHERE last_synced_at is not null
            ) 
            AND last_synced_at is null;
        `;

    const db = new DB();
    await db.executeQueryForSingleResult(query);
}

export const deleteSettingById = async(id: number) => {
    const query = `
        DELETE FROM ${table} 
        WHERE id = ${id}
        `;

    const db = new DB();
    await db.executeQueryForSingleResult(query);
}
