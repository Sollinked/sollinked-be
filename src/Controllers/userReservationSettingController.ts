import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getInsertQuery, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { ProcessedUserReservationSetting, UserReservationSetting, fillableColumns } from "../Models/userReservationSetting";

const table = 'user_reservation_settings';

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
    const result = await db.executeQueryForSingleResult<UserReservationSetting>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserReservationSetting>(query);
    if(!result) {
        return result;
    }

    let ret: ProcessedUserReservationSetting[] = result.map(x => ({
        ...x,
        reservation_price: Number(x.reservation_price),
    }));

    return ret;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserReservationSetting>(query);

    return result ?? [];
}

// update
export const update = async(user_id: number, settings: UserReservationSetting[]): Promise<void> => {
    // filter
    const db = new DB();

    const deleteQuery = `DELETE FROM ${table} WHERE user_id = ${user_id}`;
    await db.executeQuery(deleteQuery);

    let columns = ['user_id', 'day', 'hour', 'reservation_price'];
    let values: any[] = []; // change test to admin later
    settings.forEach(setting => {
        values.push([user_id, setting.day, setting.hour, setting.reservation_price]);
    });

    if(values.length === 0) {
        return;
    }

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
