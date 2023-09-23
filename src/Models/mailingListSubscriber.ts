export type MailingListSubscriber = {
    id: number;
    mailing_list_price_tier_id: number;
    user_id: number;
    price_id: string;
    expiry_date: string;
    is_cancelled: boolean;
}

export const fillableColumns = [
    'id',
    'mailing_list_price_tier_id',
    'user_id',
    'price_id',
    'expiry_date',
    'is_cancelled',
];