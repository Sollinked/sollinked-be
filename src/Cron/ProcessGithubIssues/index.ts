import { GithubBot } from '../../GithubBot';
import * as userGithubSettingController from '../../Controllers/userGithubSettingController';
import DB from '../../DB';

export const processGithubIssues = async() => {
    let userGithubSettings = await userGithubSettingController.list();
    if(!userGithubSettings){

        
        await DB.log('ProcessGithubIssues', 'processGithubIssues', 'Missing setting');
        return;
    }

    for(const [index, setting] of userGithubSettings.entries()) {
        let bot = new GithubBot(setting);
        try {
            await bot.processUnwantedIssues();
        }

        catch(e: any) {
            
            await DB.log('ProcessGithubIssues', 'processGithubIssues', e.toString());
        }
    }
}