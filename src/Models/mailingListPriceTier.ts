export type MailingListPriceTier = {
    id: number;
    mailing_list_id: number;
    price_id: string;
    paymentlink_id: string;
    name: string;
    description?: string;
    amount: string;
    currency: string;
    charge_every: number;
    prepay_month: number;
    subscriber_count: number;
    is_active: boolean;
}

export type ProcessedMailingListPriceTier = {
    id: number;
    mailing_list_id: number;
    price_id: string;
    paymentlink_id: string;
    name: string;
    description?: string;
    amount: number;
    currency: string;
    charge_every: number;
    prepay_month: number;
    subscriber_count: number;
    is_active: boolean;
}

export const fillableColumns = [
    'id',
    'mailing_list_id',
    'price_id',
    'paymentlink_id',
    'name',
    'description',
    'amount',
    'currency',
    'charge_every',
    'prepay_month',
    'is_active',
];