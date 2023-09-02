export type UserGithubTier = {
    id: number;
    user_github_id: number;
    value_usd: string;
    label: string;
    color: string;
}

export type ProcessedUserGithubTier = {
    id: number;
    user_github_id: number;
    value_usd: number;
    label: string;
    color: string;
}

export const fillableColumns = [
    'id',
    'user_github_id',
    'value_usd',
    'label',
    'color',
];