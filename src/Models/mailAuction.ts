import { AuctionStats, PublicBidder } from "./mailBid";

export type MailAuction = {
    id: number;
    user_id: number;
    start_date: string;
    end_date: string;
    min_bid: number;
    processed_at?: string;
    created_at: string;
    deleted_at?: string;
    winner_count: number;
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
    winner_count: number;
}

export type PublicMailAuctionWithBidder = {
    id: number;
    display_name: string;
    profile_picture?: string;
    start_date: number; // unix
    end_date: number; // unix
    min_bid: number;
    winner_count: number;

    bidders: PublicBidder[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'start_date',
    'end_date',
    'min_bid',
    'processed_at',
    'created_at',
    'deleted_at',
    'winner_count',
];