import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userGithubSettingController from '../Controllers/userGithubSettingController';
import * as userGithubTierController from '../Controllers/userGithubTierController';
import * as userGithubWhitelistController from '../Controllers/userGithubWhitelistController';
import _ from 'lodash';

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

    let users = await userController.find({ address });
    if(!users) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    let user = users[0];
    await userGithubSettingController.create({ repo_link: data.repo_link, user_id: user.id });

    return res.send({
        success: true,
        message: "Success",
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
    let users = await userController.find({ address });

    if(!users) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    let user = users[0];
    let setting = await userGithubSettingController.view(id);
    if(!setting) {
        return res.send({
            success: false,
            message: "Unable to find setting",
        });
    }

    if(setting.user_id !== user.id) {
        return res.status(401).send("Unauthorized");
    }
    
    await userGithubSettingController.update(id, { repo_link: data.repo_link, user_id: user.id });
    await userGithubTierController.update(id, data.tiers);
    await userGithubWhitelistController.update(id, data.whitelists);

    return res.send({
        success: true,
        message: "Success",
    });

});