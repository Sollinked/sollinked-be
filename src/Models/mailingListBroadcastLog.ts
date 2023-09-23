export type MailingListBroadcastLog = {
    id: number;
    mailing_list_broadcast_id: number;
    is_success: boolean;
    log_text: string;
}

export const fillableColumns = [
    'id',
    'mailing_list_broadcast_id',
    'is_success',
    'log_text',
];