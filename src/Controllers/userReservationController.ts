import { clawbackSOLFrom, formatDBParamsToStr, getAddressNftDetails, getInsertQuery, sendSOLTo, transferCNfts } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { ProcessedUserReservation, UserReservation, fillableColumns } from "../Models/userReservation";
import { RESERVATION_STATUS_BLOCKED } from "../Constants";

const table = 'user_reservations';

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
    const result = await db.executeQueryForSingleResult<UserReservation>(query);

    return result ?? {};
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, ' AND ');
    const query = `SELECT * FROM ${table} WHERE ${params} ORDER BY date desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserReservation>(query);

    return result;
}

export const findForUser = async(user_id: number, hideDetails: boolean = false) => {
    // ignore cancelled
    const query = `SELECT * FROM ${table} WHERE user_id = ${user_id} AND status >= ${RESERVATION_STATUS_BLOCKED} ORDER BY date asc`;

    const db = new DB();
    let result = await db.executeQueryForResults<UserReservation>(query);

    if(!result) {
        return result;
    }

    let ret: ProcessedUserReservation[] = [];
    if(hideDetails) {
        ret = result.map(x => {
            return ({
                id: x.id,
                date: x.date,
                user_id: x.user_id,
                reservation_price: Number(x.reservation_price),
                status: x.status,
            } as ProcessedUserReservation);
        })
    }

    else {
        ret = result.map(x => {
            return ({
                ...x,
                reservation_price: Number(x.reservation_price),
            } as ProcessedUserReservation);
        });
    }

    return ret;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table} ORDER BY value_usd desc`;

    const db = new DB();
    const result = await db.executeQueryForResults<UserReservation>(query);

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
