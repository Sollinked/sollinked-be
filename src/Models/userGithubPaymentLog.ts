export type UserGithubPaymentLog = {
    id: number;
    user_github_id: number;
    value_usd: string;
    tx_hash: string;
    from_user: string;
    from_email: string;
    title: string;
    body: string;
}

export type ProcessedUserGithubPaymentLog = {
    id: number;
    user_github_id: number;
    value_usd: number;
    tx_hash: string;
    from_user: string;
    from_email: string;
    title: string;
    body: string;
}

export const fillableColumns = [
    'id',
    'user_github_id',
    'value_usd',
    'tx_hash',
    'from_user',
    'from_email',
    'title',
    'body',
];