import { Octokit } from 'octokit';
import { getGithubCredentials } from '../../utils';
import { UserGithubSetting } from '../Models/userGithubSetting';
import moment from 'moment';

export class GithubBot {
    octokit;
    repo;
    owner;
    start_monitoring_at;
    whitelists;

    constructor (githubSettings: UserGithubSetting) {
        this.octokit = new Octokit({
            auth: getGithubCredentials(),
        });    

        let [repo, owner] = githubSettings.repo_link.split("/");
        this.repo = repo;
        this.owner = owner;
        this.start_monitoring_at = githubSettings.start_monitoring_at;
        this.whitelists = githubSettings.whitelists;
    }

    createLabel = async({
        label,
        color,
    }: {
        label: string;
        color: string;
    }) => {

        await this.octokit.request('POST /repos/{owner}/{repo}/labels', {
            owner: this.owner,
            repo: this.repo,
            name: label,
            description: "Sollinked label",
            color: color,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        console.log('Github createLabel', 'created label');
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

    readIssues = async() => {
        if(!this.start_monitoring_at) {
            console.log('GithubBot read', 'No start monitoring date');
            return;
        }

        return await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
            owner: this.owner,
            repo: this.repo,
            headers: {
              'X-GitHub-Api-Version': '2022-11-28'
            },
            since: moment(this.start_monitoring_at).format('YYYY-MM-DDTHH:mm:ssZ')
        });
    }

    closeIssues = async() => {
        let issues = await this.readIssues();
        if(!issues) {
            console.log('No issues');
            return;
        }
        for(const [index, issue] of issues.data.entries()) {
            if(this.whitelists.includes(issue.user?.email ?? "")) {
                continue;
            }

            await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
                owner: 'OWNER',
                repo: 'REPO',
                issue_number: issue.id,
                state: 'closed',
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            });
        }
        console.log('GithubBot close', 'finishing closing');
    }

    markIssues = async() => {
        let issues = await this.readIssues();
        if(!issues) {
            console.log('No issues');
            return;
        }
        for(const [index, issue] of issues.data.entries()) {
            if(this.whitelists.includes(issue.user?.email ?? "")) {
                continue;
            }

            await this.octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
                owner: 'OWNER',
                repo: 'REPO',
                issue_number: issue.id,
                labels: ['Unpaid'],
                headers: {
                  'X-GitHub-Api-Version': '2022-11-28'
                }
            });
        }
        console.log('GithubBot mark', 'finishing marking');
    }
}