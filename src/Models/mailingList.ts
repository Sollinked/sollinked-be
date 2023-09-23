import { ProcessedMailingListPriceTier } from "./mailingListPriceTier";

export type MailingList = {
    id: number;
    user_id: number;
    product_id: string;
    wallet_id: string;
    tiers: ProcessedMailingListPriceTier[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'product_id',
    'wallet_id',
];