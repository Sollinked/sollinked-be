export type MailingListSubscriber = {
    id: number;
    mailing_list_id: number;
    user_id: number;
    subscription_id: string;
    expiry_date: string;
    is_cancelled: boolean;
}

export const fillableColumns = [
    'id',
    'mailing_list_id',
    'user_id',
    'subscription_id',
    'expiry_date',
    'is_cancelled',
];