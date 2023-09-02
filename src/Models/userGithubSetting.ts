import { UserGithubIssueLog } from "./userGithubIssueLog";
import { UserGithubTier } from "./userGithubTier";

export type UserGithubSetting = {
    id: number;
    user_id: number;
    repo_link: string;
    start_monitoring_at?: string;
    whitelists: string[];
    tiers: UserGithubTier[];
    logs: UserGithubIssueLog[];
}

export const fillableColumns = [
    'user_id',
    'repo_link',
    'synced_at',
];