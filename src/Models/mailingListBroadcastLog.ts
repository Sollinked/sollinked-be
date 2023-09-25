export type MailingListBroadcastLog = {
    id: number;
    mailing_list_broadcast_id: number;
    to_email: string;
    is_success: boolean;
    success_at?: string;
    log_text: string;
}

export const fillableColumns = [
    'id',
    'mailing_list_broadcast_id',
    'to_email',
    'is_success',
    'success_at',
    'log_text',
];