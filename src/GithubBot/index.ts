import { Octokit } from 'octokit';
import { getGithubCredentials } from '../../utils';
import { UserGithubSetting } from '../Models/userGithubSetting';
import * as userGithubSettingController from '../Controllers/userGithubSettingController';
import moment from 'moment';
import fetch from 'node-fetch';
import { ProcessedUserGithubTier } from '../Models/userGithubTier';

const DESCRIPTION = "Auto generated by Sollinked bot";
export class GithubBot {
    private octokit;
    private repo = "";
    private owner = "";
    private last_synced_at: string | undefined = undefined;
    private whitelists: string[] = [];
    private behavior = 'mark';
    private id = 0;

    constructor (setting?: UserGithubSetting) {
        let { key, email, name } = getGithubCredentials();
        this.octokit = new Octokit({
            auth: key,
            request: { fetch }
        });

        if(setting) {
            let [,owner, repo] = setting.repo_link.split("/");
            this.repo = repo;
            this.owner = owner;
            this.last_synced_at = setting.last_synced_at;
            this.whitelists = [...(setting.whitelists ?? []), email, name, owner];
            this.behavior = setting.behavior;
            this.id = setting.id;
        }
    }

    getAllLabels = async() => {
        if(!this.repo) {
            console.log('Github get labels', 'no repo');
            return;
        }

        try {
            return (await this.octokit.request('GET /repos/{owner}/{repo}/labels', {
                owner: this.owner,
                repo: this.repo,
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            })).data;
        }

        catch {
            return [];
        }
    }

    createLabel = async({
        label,
        color,
    }: {
        label: string;
        color: string;
    }) => {
        if(!this.repo) {
            console.log('GithubBot createLabel', 'no repo');
            return;
        }

        color = color.replace("#", "");
        try {
            await this.octokit.request('POST /repos/{owner}/{repo}/labels', {
                owner: this.owner,
                repo: this.repo,
                name: label,
                description: DESCRIPTION,
                color: color? color : '000000',
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });
        }

        catch(e: any) {
            console.log(e.message);
        }

        console.log('GithubBot createLabel', 'created label');
    }

    updateLabel = async({
        label,
        color,
    }: {
        label: string;
        color: string;
    }) => {
        if(!this.repo) {
            console.log('GithubBot update label', 'no repo');
            return;
        }

        color = color.replace("#", "");
        await this.octokit.request('PATCH /repos/{owner}/{repo}/labels/{name}', {
            owner: this.owner,
            repo: this.repo,
            name: label,
            color: color? color : '000000',
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        })

        console.log('GithubBot update label', 'done');
    }

    createOrUpdateLabels = async(tiers: ProcessedUserGithubTier[]) => {
        if(!this.repo) {
            console.log('GithubBot create or update labels', 'no repo');
            return;
        }

        let labels = (await this.getAllLabels()) ?? [];
        let labelNames = labels.filter(x => x.description === DESCRIPTION).map(x => x.name);
        tiers.forEach(async(tier) => {
            if(labelNames.includes(tier.label)) {
                console.log('updating', tier.label);
                await this.updateLabel({
                    label: tier.label,
                    color: tier.color,
                });
            }

            else {
                console.log('creating', tier.label);
                await this.createLabel({
                    label: tier.label,
                    color: tier.color,
                });
            }
        });

        console.log('GithubBot create or update labels', 'done');
    }

    createIssue = async ({
        title,
        body,
        label
    }: {
        title: string;
        body: string;
        label: string;
    }) => {
        if(!this.repo) {
            console.log('GithubBot createIssue', 'no repo');
            return;
        }
        await this.octokit.request('POST /repos/{owner}/{repo}/issues', {
            owner: this.owner,
            repo: this.repo,
            title,
            body,
            assignees: [],
            milestone: undefined,
            labels: [label],
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        console.log('GithubBot create', 'created issue');
    }

    readIssues = async(state: 'open' | 'closed' | 'all' = "all") => {
        if(!this.repo) {
            console.log('Github readIssues', 'no repo');
            return;
        }

        if(!this.last_synced_at) {
            console.log('GithubBot read', 'No start monitoring date');
            return;
        }

        return (await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
            owner: this.owner,
            repo: this.repo,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            },
            state,
            since: moment(this.last_synced_at).format('YYYY-MM-DDTHH:mm:ssZ')
        })).data;
    }

    closeIssues = async() => {
        if(!this.repo) {
            // console.log('Github closeIssues', 'no repo');
            return;
        }

        let issues = await this.readIssues("open");
        if(!issues) {
            console.log('No issues');
            return;
        }
        for(const [index, issue] of issues.entries()) {
            if(!issue.user) {
                console.log('Github bot', 'user is empty');
                continue;
            }

            let issuer = issue.user.login;
            let issuerEmail = issue.user.email ?? "";
            if(!issuer) {
                console.log('Github bot', 'issuer is empty');
                continue;
            }

            if(this.whitelists.includes(issuer) || this.whitelists.includes(issuerEmail)) {
                console.log('Github bot', 'issuer in whitelist');
                continue;
            }

            if(moment(issue.created_at).isBefore(this.last_synced_at)) {
                return;
            }

            await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
                owner: this.owner,
                repo: this.repo,
                issue_number: issue.number,
                state: 'closed',
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            console.log(`GithubBot`, `Closed /${this.owner}/${this.repo} issue no ${issue.number}`);
        }
    }

    markIssues = async() => {
        if(!this.repo) {
            // console.log('Github markIssues', 'no repo');
            return;
        }

        let issues = await this.readIssues("open");
        if(!issues) {
            console.log('No issues');
            return;
        }
        for(const [index, issue] of issues.entries()) {
            if(!issue.user) {
                console.log('Github bot', 'user is empty');
                continue;
            }

            let issuer = issue.user.login;
            let issuerEmail = issue.user.email ?? "";
            if(!issuer) {
                console.log('Github bot', 'issuer is empty');
                continue;
            }

            if(this.whitelists.includes(issuer) || this.whitelists.includes(issuerEmail)) {
                console.log('Github bot', 'issuer in whitelist');
                continue;
            }

            if(moment(issue.created_at).isBefore(this.last_synced_at)) {
                return;
            }
            
            await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
                owner: this.owner,
                repo: this.repo,
                issue_number: issue.number,
                labels: ['Unpaid'],
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            });
            console.log(`GithubBot`, `Marked /${this.owner}/${this.repo} issue no ${issue.number}`);
        }
    }

    processUnwantedIssues = async() => {
        switch(this.behavior) {
            case 'close':
                this.closeIssues();
                break;
            case 'mark':
                this.markIssues();
                break;
            default:
                break;
        }
        await userGithubSettingController.updateLastSynced(this.id);
    }

    // invitations
    getAllInvitations = async() => {
        return (await this.octokit.request('GET /user/repository_invitations', {
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            }
        })).data;
    }

    getAllOrgInvitations = async() => {
        return (await this.octokit.request('GET /user/memberships/orgs', {
            headers: {
              'X-GitHub-Api-Version': '2022-11-28',
            },
            state: 'pending',
        })).data;
    }

    // accept invitations from everyone
    acceptAllInvitations = async() => {
        let invitations = await this.getAllInvitations();
        for(const [index, invitation] of invitations.entries()) {
            try {
                await this.octokit.request('PATCH /user/repository_invitations/{invitation_id}', {
                    invitation_id: invitation.id,
                    headers: {
                      'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
            }

            catch(e) {
                console.log('GitHub Bot', 'Unable to accept invitaion');
            }
        }
        let orgInvitations = await this.getAllOrgInvitations();
        for(const [index, invitation] of orgInvitations.entries()) {
            try {
                await this.octokit.request('PATCH /user/memberships/orgs/{org}', {
                    org: invitation.organization.login,
                    state: 'active',
                    headers: {
                      'X-GitHub-Api-Version': '2022-11-28'
                    }
                  })
            }

            catch(e) {
                console.log('GitHub Bot', 'Unable to accept organization invitaion');
            }
        }
    }

    // syncs repo based on uuid
    trySyncRepo = async() => {
        try {
            let issues = (await this.octokit.request('GET /issues', {
                state: 'open',
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            })).data;
    
            issues.forEach(async(issue) => {
                // delete the issue
                let uuid = issue.body?.trim() ?? "";
                if(!uuid) {
                    console.log('Github try sync repo', 'not uuid');
                    return;
                }

                if(!issue.repository) {
                    console.log('Github try sync repo', 'no repo');
                    return;
                }

                let [owner, repo] = issue.repository.full_name.split('/');
                // close the repo
                await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
                    owner,
                    repo,
                    issue_number: issue.number,
                    state: 'closed',
                    headers: {
                      'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                this.owner = owner;
                this.repo = repo;

                await this.createLabel({ label: "Unpaid", color: 'f375b6' });

                let repoLink = `/${issue.repository.full_name}`.trim();
                let settings = await userGithubSettingController.find({ uuid, repo_link: repoLink });
                if(!settings || settings.length === 0) {
                    console.log('Github try sync repo', 'no settings found');
                    return;
                }

                // update synced time
                await userGithubSettingController.updateLastSynced(settings[0].id);
            });
        }

        catch(e: any) {
            console.log(e.message);
        }
    }

    runAdminTasks = async() => {
        await this.acceptAllInvitations();
        await this.trySyncRepo();
        await userGithubSettingController.deleteDuplicate();
    }
}