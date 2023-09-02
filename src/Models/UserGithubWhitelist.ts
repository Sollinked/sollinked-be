export type UserGithubWhitelist = {
    id: number;
    user_github_id: number;
    username: string;
}

export const fillableColumns = [
    'user_github_id',
    'username',
];