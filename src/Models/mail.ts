export type Mail = {
    id: number;
    profile_id: number;
    from: string;
    to: string;
    message_id: string;
    tiplink_url: string;
    tiplink_public_key: string;
    is_processed: boolean;
    has_responded: boolean;
}

export const fillableColumns = [
    'id',
    'profile_id',
    'from_email',
    'to_email',
    'message_id',
    'tiplink_url',
    'tiplink_public_key',
    'is_processed',
    'has_responded',
];