export type MailingListBroadcast = {
    id: number;
    mailing_list_id: number;
    created_at: string;
    execute_at: string;
    is_executing: boolean;
}

export const fillableColumns = [
    'id',
    'mailing_list_id',
    'created_at',
    'execute_at',
    'is_executing',
];