import { AuctionStats, PublicBidder } from "./mailBid";

export type MailAuction = {
    id: number;
    user_id: number;
    start_date: string;
    end_date: string;
    min_bid: number;
    created_at: string;
    deleted_at?: string;
}

export type ProcessedMailAuction = MailAuction & {
    stats?: AuctionStats;
}

export type PublicMailAuction = {
    id: number;
    display_name: string;
    profile_picture?: string;
    start_date: number; // unix
    end_date: number; // unix
    min_bid: number;
}

export type PublicMailAuctionWithBidder = {
    id: number;
    display_name: string;
    profile_picture?: string;
    start_date: number; // unix
    end_date: number; // unix
    min_bid: number;

    bidders: PublicBidder[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'start_date',
    'end_date',
    'min_bid',
    'created_at',
    'deleted_at',
];