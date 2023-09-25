import { MailingListPriceTier, ProcessedMailingListPriceTier } from "./mailingListPriceTier";

export type MailingListSubscriber = {
    id: number;
    mailing_list_price_tier_id: number;
    user_id: number;
    price_id: string;
    email_address: string;
    expiry_date: string;
    is_cancelled: boolean;

    // generated
    price_tier?: ProcessedMailingListPriceTier;
}

export const fillableColumns = [
    'id',
    'mailing_list_price_tier_id',
    'user_id',
    'price_id',
    'email_address',
    'expiry_date',
    'is_cancelled',
];