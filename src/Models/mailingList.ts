export type MailingList = {
    id: number;
    user_id: number;
    product_id: string;
}

export const fillableColumns = [
    'id',
    'user_id',
    'product_id',
];