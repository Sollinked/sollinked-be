import { formatDBParamsToStr, getProfilePictureLink } from "../../utils";
import DB from "../DB"
import _ from "lodash";
import { MailAuction, ProcessedMailAuction, PublicMailAuction, PublicMailAuctionWithBidder, fillableColumns } from "../Models/mailAuction";
import { PublicBidder } from "../Models/mailBid";
import * as mailBidController from './mailBidController';

const table = 'mail_auctions';

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

    
    const result = await DB.executeQueryForSingleResult<MailAuction>(query);

    return result;
}

export const publicView = async(id: number) => {
    const query = `SELECT 
                        a.id,
                        u.display_name,
                        u.profile_picture,
                        EXTRACT(EPOCH FROM a.start_date) as start_date,
                        EXTRACT(EPOCH FROM a.end_date) as end_date,
                        min_bid,
                        winner_count
                   FROM mail_auctions a
                   JOIN users u on u.id = a.user_id
                   WHERE a.id = ${id}
                     AND deleted_at is null`;
    
    const result = await DB.executeQueryForSingleResult<PublicMailAuction>(query);

    if(result) {
        result.profile_picture = getProfilePictureLink(result.profile_picture);
    }
    
    const bidderQuery = `SELECT 
                            coalesce(u.display_name, u.address) as display_name,
                            u.profile_picture,
                            value_usd
                        FROM mail_bids b
                        JOIN users u on u.id = b.user_id
                        WHERE b.auction_id = ${id}
                          AND value_usd > 0
                        ORDER BY value_usd desc, updated_at asc`

    const bidderResult = await DB.executeQueryForResults<PublicBidder>(bidderQuery);
    let processedBidderResult: PublicBidder[] = [];
    if(bidderResult && bidderResult.length > 0) {
        for(let res of bidderResult) {
            res.profile_picture = getProfilePictureLink(res.profile_picture);
            processedBidderResult.push(res);
        }
    }

    return {
        ...result,
        bidders: processedBidderResult,
    } as PublicMailAuctionWithBidder;
}

export const getUserLiveMailAuctions = async(user_id: number) => {
    const query = `
            SELECT ${fillableColumns.join(",")} 
            FROM ${table} 
            WHERE user_id = ${user_id}
              AND deleted_at is null 
              AND end_date > CURRENT_TIMESTAMP
            ORDER BY end_date`;

    
    const result = await DB.executeQueryForResults<MailAuction>(query);
    return result;
}

// find (all match)
export const find = async(whereParams: {[key: string]: any}) => {
    const params = formatDBParamsToStr(whereParams, { separator: ' AND ', isSearch: true });
    const query = `SELECT * 
                    FROM ${table} 
                    WHERE ${params}
                      AND deleted_at is null`;

    
    const result = await DB.executeQueryForResults<MailAuction>(query);

    return result;
}

export const findByUserId = async(user_id: number) => {
    // ignore cancelled
    const query = `SELECT * 
                    FROM ${table} 
                    WHERE user_id = ${user_id}
                     AND deleted_at is null
                    ORDER BY id desc`;

    
    let result = await DB.executeQueryForResults<MailAuction>(query);

    if(!result) {
        return result;
    }


    let ret: ProcessedMailAuction[] = [];
    for(const auction of result) {
        ret.push({
            ...auction,
            stats: await mailBidController.getStatsForAuction(auction.id),
        });
    }

    return ret;
}

export const getUnprocessedEndedAuctions = async() => {
    const query = `SELECT * 
                    FROM ${table} 
                    WHERE processed_at is null
				      AND EXTRACT(EPOCH FROM end_date) <= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
                      AND deleted_at is null`;

    
    const result = await DB.executeQueryForResults<MailAuction>(query);
    return result;
}

// list (all)
export const list = async() => {
    const query = `SELECT * FROM ${table}`;
    const result = await DB.executeQueryForResults<MailAuction>(query);
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
export const softDelete = async(id: number) => {
    const query = `UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    await DB.executeQuery(query);
    return;
}

export const live = async(withPublicKey?: boolean, withZeroValue?: boolean) => {
    const query = `SELECT 
                        a.id,
                        coalesce(u.display_name, u.address) as display_name,
                        u.profile_picture,
                        EXTRACT(EPOCH FROM a.start_date) as start_date,
                        EXTRACT(EPOCH FROM a.end_date) as end_date,
                        a.winner_count
                   FROM mail_auctions a
                   JOIN users u on u.id = a.user_id
                   WHERE EXTRACT(EPOCH FROM a.end_date) > EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
                     AND deleted_at is null
                     AND processed_at is null
                   ORDER BY end_date`;
    
    const result = await DB.executeQueryForResults<PublicMailAuction>(query);

    if(!result) {
        return [];
    }

    let publicAuctionWithBidders: PublicMailAuctionWithBidder[] = [];
    if(result && result.length > 0) {
        for(let auction of result) {
            const bidderQuery = `SELECT 
                        coalesce(u.display_name, u.address) as display_name,
                        u.profile_picture,
                        value_usd
                        ${withPublicKey? ', tiplink_public_key' : ''}
                        ${withPublicKey? ', b.id' : ''}
                    FROM mail_bids b
                    JOIN users u on u.id = b.user_id
                    WHERE b.auction_id = ${auction.id}
                     ${withZeroValue? '' : 'AND value_usd > 0'}
                    ORDER BY value_usd desc, updated_at asc`

            const bidderResult = await DB.executeQueryForResults<PublicBidder>(bidderQuery);
            let processedBidderResult: PublicBidder[] = [];
            if(bidderResult && bidderResult.length > 0) {
                for(let res of bidderResult) {
                    res.profile_picture = getProfilePictureLink(res.profile_picture);
                    processedBidderResult.push(res);
                }
            }

            if(auction.profile_picture) {
                auction.profile_picture = getProfilePictureLink(auction.profile_picture);
            }
            
            publicAuctionWithBidders.push({
                ...auction,
                bidders: processedBidderResult,
            })
        }
    }

    return publicAuctionWithBidders;
}

export const markAsProcessed = async(id: number) => {
    // filter
    const query = `UPDATE ${table} SET processed_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    await DB.executeQueryForSingleResult(query);
}