export type ContentPayment = {
    id: number;
    user_id: number;
    content_id: number;
    tx_hash: string;
    value_usd: string;
}

export const fillableColumns = [
    'user_id',
    'content_id',
    'tx_hash',
    'value_usd',
];