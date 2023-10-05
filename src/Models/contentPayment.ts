export type ContentPaymentType = "pass" | "single";
export type ContentPayment = {
    id: number;
    user_id: number;
    content_id: number;
    tx_hash: string;
    value_usd: string;
    is_processed: boolean;
    type: ContentPaymentType;
}

export const fillableColumns = [
    'user_id',
    'content_id',
    'tx_hash',
    'value_usd',
    'is_processed',
    'type',
];