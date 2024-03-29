import { PastBroadcast } from "./mailingListBroadcast";
import { ProcessedMailingListPriceTier } from "./mailingListPriceTier";

export type MailingListSubscriber = {
    id: number;
    mailing_list_price_tier_id: number;
    user_id: number;
    price_id: string;
    value_usd: number;
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
    'value_usd',
    'email_address',
    'expiry_date',
    'is_cancelled',
];