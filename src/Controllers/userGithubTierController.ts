import { formatDBParamsToStr, getInsertQuery, } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { ProcessedUserGithubTier, UserGithubTier, fillableColumns } from "../Models/userGithubTier";
import { GithubBot } from "../GithubBot";
import { UserGithubSetting } from "../Models/userGithubSetting";

const table = 'user_github_tiers';

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
    const result = await db.executeQueryForSingleResult<UserGithubTier>(query);

    if(!result) {
        return result;
    }

    let ret: ProcessedUserGithubTier = {
        ...result,
        value_usd: Number(result.value_usd),
    }
    return ret;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY value_usd desc`;

    const db = new DB();
    const results = await db.executeQueryForResults<UserGithubTier>(query);
    if(!results) {
        return results;
    }

    let ret: ProcessedUserGithubTier[] = results.map(x => ({
        ...x,
        value_usd: Number(x.value_usd),
    }));

    return ret;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY value_usd desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserGithubTier>(query);

    return result ?? [];
}

// update
export const update = async(setting: UserGithubSetting, tiers: ProcessedUserGithubTier[]): Promise<void> => {
    // filter
    const db = new DB();

    const deleteQuery = `DELETE FROM ${table} WHERE user_github_id = ${setting.id}`;
    await db.executeQuery(deleteQuery);

    let columns = ['user_github_id', 'value_usd', 'label', 'color'];
    let values: any[] = []; // change test to admin later
    tiers.forEach(tier => {
        values.push([setting.id, tier.value_usd, tier.label, tier.color]);
    });

    if(values.length === 0){
        return;
    }

    let bot = new GithubBot(setting);
    await bot.createOrUpdateLabels(tiers);

    let query = getInsertQuery(columns, values, table);
    await db.executeQueryForSingleResult(query);
}

// delete (soft delete?)
// export const delete = async(userId: number) => {
//     const query = `DELETE FROM ${table} WHERE user_id = ${userId}`;

//     const db = new DB();
//     await db.executeQueryForSingleResult(query);

//     return result;
// }
