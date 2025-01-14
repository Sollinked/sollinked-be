export type MailBid = {
    id: number;
    auction_id: number;
    user_id: number;
    tiplink_url: string;
    tiplink_public_key: string;
    value_usd: number;
    subject: string;
    message: string; // in html
    is_success: boolean;
    created_at: string;
    updated_at: string;
}

export type PublicBidder = {
    id?: number;
    display_name: string;
    profile_picture?: string;
    value_usd: number;
    tiplink_public_key?: string;
}

export type Bidder = {
    id: number;
    user_id: number;
    address: string;
    subject: string;
    message: string;
    email?: string;
    tiplink_url: string;
    tiplink_public_key: string;
    value_usd: string;
}

export type AuctionStats = {
    highest_bid: number;
    bid_count: number;
}

export type OwnPreviousBid = { 
    message: string;
    subject: string; 
    value_usd: number;
}

export const fillableColumns = [
    'id',
    'auction_id',
    'user_id',
    'tiplink_url',
    'tiplink_public_key',
    'value_usd',
    'subject',
    'message',
    'is_success',
    'created_at',
    'updated_at',
    'email',
];