export const UNLIMITED_PASS = -1;

export type ContentPass = {
    id: number;
    user_id: number;
    name: string;
    description: string;
    amount: number; // limited amount
    value_usd: string; // price per pass
    cnft_count: number; // how many minted
    paymentlink_id?: string;
}

export type ProcessedContentPass = {
    id: number;
    user_id: number;
    name: string;
    description: string;
    amount: number; // limited amount
    value_usd: number; // price per pass
    cnft_count: number; // how many minted
    paymentlink_id?: string;
}

export const fillableColumns = [
    'id',
    'user_id',
    'name',
    'description',
    'amount',
    'value_usd',
    'paymentlink_id',
];