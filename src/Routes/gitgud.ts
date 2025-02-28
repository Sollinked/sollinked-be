import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userGithubSettingController from '../Controllers/userGithubSettingController';
import * as userGithubTierController from '../Controllers/userGithubTierController';
import * as userGithubWhitelistController from '../Controllers/userGithubWhitelistController';
import * as userGithubPaymentLogController from '../Controllers/userGithubPaymentLogController';
import _ from 'lodash';
import { getTokensTransferredToUser, getTx, sleep } from '../../utils';
import moment from 'moment';
import { GithubBot } from '../GithubBot';
import { USDC_ADDRESS } from '../Constants';
import DB from '../DB';

export const routes = Router();

routes.post('/new', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.repo_link) {
        return res.status(400).send("Invalid params");
    }

    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let uuid = await userGithubSettingController.create({ repo_link: data.repo_link, user_id: user.id });

    return res.send({
        success: true,
        message: "Success",
        data: uuid,
    });
});

routes.post('/update/:user_github_id', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let { user_github_id } = req.params;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.repo_link) {
        return res.status(400).send("Invalid params");
    }

    if(!user_github_id) {
        return res.status(400).send("Invalid params");
    }

    let id = Number(user_github_id);
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let setting = await userGithubSettingController.view(id);
    if(!setting) {
        return res.status(404).send("Unable to find setting");
    }

    if(setting.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }
    
    await userGithubSettingController.update(id, { repo_link: data.repo_link, user_id: user.id, behavior: data.behavior });
    await userGithubTierController.update(setting, data.tiers);
    await userGithubWhitelistController.update(id, data.whitelists);

    return res.send({
        success: true,
        message: "Success",
    });

});

routes.post('/toggle/:user_github_id', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let { user_github_id } = req.params;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!user_github_id) {
        return res.status(400).send("Invalid params");
    }

    let id = Number(user_github_id);
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let setting = await userGithubSettingController.view(id);
    if(!setting) {
        return res.status(404).send("Unable to find setting");
    }

    if(setting.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }
    
    await userGithubSettingController.update(id, { is_active: !setting.is_active });

    return res.send({
        success: true,
        message: "Success",
    });

});


routes.delete('/:user_github_id', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let { user_github_id } = req.params;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!user_github_id) {
        return res.status(400).send("Invalid params");
    }

    let id = Number(user_github_id);
    let user = await userController.findByAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    let setting = await userGithubSettingController.view(id);
    if(!setting) {
        return res.status(404).send("Unable to find setting");
    }

    if(setting.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }
    
    await userGithubSettingController.deleteSettingById(id);

    return res.send({
        success: true,
        message: "Success",
    });

});

// create new issue
routes.post('/newIssue', async(req, res) => {
    try {
        let data = req.body;
        let { owner, repo, title, body, txHash, fromUser, fromEmail, repo_link } = data;
    
        if(repo_link) {
            let split = repo_link.split("/");
            owner = split[1];
            repo = split[2];
        }
        
        if(!data) {
            return res.status(400).send("No data");
        }

        if(!owner || !repo || !txHash || !title || !body) {
            return res.status(400).send("Invalid Params");
        }

        let settings = await userGithubSettingController.findActiveSynced({ repo_link: `/${owner}/${repo}`});
        if(!settings || settings.length === 0) {
            return res.status(404).send("Cant find settings");
        }

        let payment = await userGithubPaymentLogController.create({
            user_github_id: settings[0].id,
            tx_hash: txHash,
            from_user: fromUser,
            from_email: fromEmail,
            title,
            body,
        });

        if(!payment) {
            return res.status(500).send("Server Error");
        }

        // check status
        let retries = 0;

        // with some minor adjustment
        let user = await userController.view(settings[0].user_id);

        if(!user) {
            return res.status(404).send("Cant find user");
        }

        while(retries < 10) {
            try {
                let valueUsd = await getTokensTransferredToUser(txHash, user!.address, USDC_ADDRESS);
                await userGithubPaymentLogController.update(payment.id, { value_usd: valueUsd });

                let currentChosenValueUsd = 0;
                let label = "";
                settings[0].tiers.forEach(tier => {
                    if(valueUsd >= tier.value_usd && tier.value_usd >= currentChosenValueUsd) {
                        currentChosenValueUsd = tier.value_usd;
                        label = tier.label;
                    }
                });

                if(!label) {
                    
                    await DB.log('gitgud', '/newIssue', 'No labels');
                    break;
                }
                
                // dont need await
                let bot = new GithubBot(settings[0]);
                if(fromEmail || fromUser) {
                    body += '\n\n\nReported By';
                    body += fromUser? `\n\n${fromUser}` : "";
                    body += fromEmail? `\n\n${fromEmail}` : "";
                }

                body += '\n\n\n';
                body += `[Proof of Payment](https://solana.fm/tx/${txHash}?cluster=mainnet-qn1)`;

                bot.createIssue({
                    title,
                    body,
                    label
                });
                break;
            }

            catch {
                retries++;
                await sleep(2000); //sleep 2s
                continue;
            }
        }

        return res.send({
            success: true,
            message: "Success",
        });
    }

    catch(e) {
        return res.status(500).send("Server error");
    }
});

routes.get('/tiers/:owner/:repo', async(req, res) => {
    try {
        let { owner, repo } = req.params;
        if(!owner || !repo) {
            return res.status(400).send("Invalid Params");
        }

        let settings = await userGithubSettingController.findActiveSynced({ repo_link: `/${owner}/${repo}`});
        if(!settings || settings.length === 0) {
            return res.status(404).send("Cant find settings");
        }

        let user = await userController.view(settings[0].user_id);
        if(!user) {
            return res.status(404).send("Cant find user");
        }

        return res.send({
            success: true,
            message: "Success",
            data: {
                tiers: settings[0].tiers,
                address: user.address,
            }
        });
    }

    catch(e) {
        return res.status(500).send("Server error");
    }
});