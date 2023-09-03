import { GithubBot } from '../../GithubBot';
import * as userGithubSettingController from '../../Controllers/userGithubSettingController';

export const processGithubIssues = async() => {
    let userGithubSettings = await userGithubSettingController.list();
    if(!userGithubSettings){
        console.log('process github issues', 'no setting');
        return;
    }

    for(const [index, setting] of userGithubSettings.entries()) {
        if(!setting.tiers) {
            console.log('process github issues', 'no tiers');
            return;
        }

        let bot = new GithubBot(setting);
        try {
            await bot.processUnwantedIssues();
        }

        catch(e) {
            console.log('Process github issues');
            console.log(e);
        }
    }
}