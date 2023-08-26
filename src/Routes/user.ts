import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userTierController from '../Controllers/userTierController';
import { contentUpload } from './Upload';
import { checkAllowedMime, verifySignature } from '../../utils';
import fs from 'fs-extra';
import _ from 'lodash';
import { VERIFY_MESSAGE } from '../Constants';

export const routes = Router();

//
routes.post('/', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.username) {
        return res.status(400).send("Invalid params");
    }
    
    await userController.create({
        address: data.address,
        username: data.username,
    });

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/update/:id', contentUpload.single('profile_picture'), async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let id = parseInt(req.params.id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    const mime = req.file?.mimetype;

    // delete file if not in whitelist
    if (mime && !checkAllowedMime(mime, ['image'])) {
        await fs.remove(req.file?.path!);
    }

    // assign profile_picture params if valid
    if (_.has(req, 'file')) {
        data.profile_picture = req.file?.filename;
    }

    // cant save address
    data = _.omit(data, ['address', 'signature']);

    if(Object.keys(data).length === 0){
        return res.send({
            success: false,
            message: "No new updates",
        });
    }

    let user = await userController.view(id);
    if(!user) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    // not the same address
    if(user.address !== address) {
        return res.status(401).send({
            success: false,
            message: "Unauthorized",
        });
    }
    
    await userController.update(id, data);

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/updateTiers/:user_id', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let user_id = parseInt(req.params.user_id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.tiers) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    // cant save address
    data = _.omit(data, ['address', 'signature']);

    if(Object.keys(data).length === 0){
        return res.send({
            success: false,
            message: "No new updates",
        });
    }

    let user = await userController.view(user_id);
    if(!user) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    // not the same address
    if(user.address !== address) {
        return res.status(401).send({
            success: false,
            message: "Unauthorized",
        });
    }
    
    try {
        await userTierController.update(user_id, data.tiers);
    }

    catch(e) {
        console.log(e);

        return res.send({
            success: false,
            message: "Unable to update user tier",
        });

    }

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/me', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }
    
    let users = await userController.find({
        address: data.address,
    });

    if(!users || users.length === 0) {
        return res.send({
            success: false,
            message: "No user found!",
        });
    }

    return res.send({
        success: true,
        message: "Success",
        data: users[0]
    });

});