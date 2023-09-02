import { ProcessedUserGithubIssueLog, UserGithubIssueLog } from "./userGithubIssueLog";
import { ProcessedUserGithubTier, UserGithubTier } from "./userGithubTier";

export type UserGithubSetting = {
    id: number;
    user_id: number;
    repo_link: string;
    start_monitoring_at?: string;
    whitelists: string[];
    tiers: ProcessedUserGithubTier[];
    logs: ProcessedUserGithubIssueLog[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'repo_link',
    'start_monitoring_at',
];