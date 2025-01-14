import { formatDBParamsToStr, getProfilePictureLink } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { AuctionStats, Bidder, MailBid, OwnPreviousBid, PublicBidder, fillableColumns } from "../Models/mailBid";

const table = 'mail_bids';

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

    return result;
}

// view (single - id)
export const view = async(id: number) => {
    const query = `SELECT ${fillableColumns.join(",")} FROM ${table} WHERE id = ${id} LIMIT 1`;

    
    const result = await DB.executeQueryForSingleResult<MailBid>(query);

    return result;
}

export const getUserMailBids = async(user_id: number) => {
    const query = `
        SELECT 
            bids.*,
            u.display_name,
            u.profile_picture,
            bids.start_date,
            bids.end_date
        FROM ${table} bids
        JOIN mail_auctions a on a.id = bids.auction_id
        JOIN users u on u.id = a.user_id
        WHERE bids.user_id = ${user_id}
        ORDER BY bids.end_date desc`;

    
    const result = await DB.executeQueryForSingleResult<MailBid>(query);
    if(!result) {
        return result;
    }

    return result;
}

export const getUserMailBidByAuctionId = async(user_id: number, auction_id: number) => {
    const query = `
        SELECT 
            subject,
            message,
            value_usd
        FROM ${table} 
        WHERE user_id = ${Number(user_id)}
          AND auction_id = ${Number(auction_id)}
        LIMIT 1`;

    const result = await DB.executeQueryForSingleResult<OwnPreviousBid>(query);
    if(!result) {
        return result;
    }

    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * FROM ${table} WHERE ${params}`;

    
    const result = await DB.executeQueryForResults<MailBid>(query);

    return result;
}

export const findByUserIdAndAuctionId = async(user_id: number, auction_id: number) => {
    // ignore cancelled
    const query = `SELECT * FROM ${table} WHERE user_id = ${user_id} and auction_id = ${auction_id}`;

    
    let result = await DB.executeQueryForSingleResult<MailBid>(query);

    if(!result) {
        return result;
    }
    return result;
}


// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;

    
    const result = await DB.executeQueryForResults<MailBid>(query);

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

export const getBiddersForAuction = async(auction_id: number) => {
    const query = `
        SELECT
            b.id,
            user_id,
            address,
            subject,
            message,
            email,
            tiplink_url,
            tiplink_public_key,
            value_usd
        FROM mail_bids b
        JOIN users u on u.id = b.user_id
        WHERE b.auction_id = ${auction_id}
        ORDER BY value_usd desc, updated_at asc
    `; 

    let bidders = await DB.executeQueryForResults<Bidder>(query);
    return bidders;
}

export const getStatsForAuction = async(auction_id: number) => {
    const query = `
        SELECT
            MAX(value_usd)::decimal as highest_bid,
            COUNT(DISTINCT id)::integer as bid_count
        FROM mail_bids
        WHERE mail_bids.auction_id = ${auction_id}
    `; 

    let stats = await DB.executeQueryForSingleResult<AuctionStats>(query);
    return stats;
}