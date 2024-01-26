export type Mail = {
    key: number;
    user_id: number;
    from_email: string;
    to_email: string;
    bcc_to_email?: string;
    message_id: string;
    sent_message_id: string;
    tiplink_url: string;
    tiplink_public_key: string;
    is_processed: boolean;
    has_responded: boolean;
    is_claimed: boolean;
    created_at: string;
    processed_at?: string;
    value_usd?: string;
    expiry_date?: string;
    claim_balance_verify_count: number;
    subject?: string;
    is_from_site: boolean;
    from_user_id?: number;
    message?: string;
    reply_message?: string;
    responded_at?: string;
}

export type ProcessedMail = {
    key: number;
    user_id: number;
    from_email: string;
    to_email: string;
    bcc_to_email?: string;
    message_id: string;
    sent_message_id: string;
    tiplink_url: string;
    tiplink_public_key: string;
    is_processed: boolean;
    has_responded: boolean;
    is_claimed: boolean;
    created_at: string;
    processed_at?: string;
    value_usd?: number;
    expiry_date?: string;
    claim_balance_verify_count: number;
    subject?: string;
    is_from_site: boolean;
    from_user_id?: number;
    message?: string;
    reply_message?: string;
    responded_at?: string;
}

export type ThreadMail = {
    id: number;
    created_at: string;
    responded_at?: string;
    subject?: string;
    message?: string; // in html
    reply_message?: string; // in html
    value_usd?: number;
    tiplink_url?: string; // will have value if the mail expired
    is_processed: boolean;
}

export const fillableColumns = [
    'id',
    'user_id',
    'from_email',
    'to_email',
    'bcc_to_email',
    'message_id',
    'sent_message_id',
    'tiplink_url',
    'tiplink_public_key',
    'is_processed',
    'has_responded',
    'is_claimed',
    'created_at',
    'processed_at',
    'value_usd',
    'expiry_date',
    'claim_balance_verify_count',
    'subject',
    'is_from_site',
    'from_user_id',
    'message',
    'reply_message',
];