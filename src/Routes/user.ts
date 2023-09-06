import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userTierController from '../Controllers/userTierController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import { contentUpload } from './Upload';
import { checkAllowedMime, verifySignature } from '../../utils';
import fs from 'fs-extra';
import _, { update } from 'lodash';
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
        return res.status(400).send("No new updates");
    }

    let user = await userController.view(id);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    // not the same address
    if(user.address !== address) {
        return res.status(401).send("Unauthorized");
    }
    
    let updateRes = await userController.update(id, data);
    if(updateRes && typeof updateRes === 'string') {
        return res.status(400).send((updateRes as string).includes("duplicate")? 'Username is claimed, please choose another!' : "Unknown Error");
    }
    
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
        return res.status(400).send("No new updates");
    }

    let user = await userController.view(user_id);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    // not the same address
    if(user.address !== address) {
        return res.status(401).send("Unauthorized");
    }
    
    try {
        await userTierController.update(user_id, data.tiers);
    }

    catch(e) {
        console.log(e);

        return res.status(500).send("Unable to update tier");

    }

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/updateReservationSettings/:user_id', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;
    let user_id = parseInt(req.params.user_id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.reservationSettings) {
        return res.status(400).send("Invalid params");
    }

    if(!user_id) {
        return res.status(400).send("No user id");
    }

    let verified = verifySignature(address, signature, VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    // cant save address
    data = _.omit(data, ['address', 'signature']);

    if(Object.keys(data).length === 0){
        return res.status(400).send("No new updates");
    }

    let user = await userController.view(user_id);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    // not the same address
    if(user.address !== address) {
        return res.status(401).send("Unauthorized");
    }
    
    try {
        await userReservationSettingController.update(user_id, data.reservationSettings);
    }

    catch(e) {
        console.log(e);

        return res.status(500).send("Unable to update user reservation settings");

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
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: users[0]
    });
});

routes.get('/name/:user_id', async(req, res) => {
    let {user_id} = req.params;

    if(!user_id) {
        return res.status(400).send("No user id");
    }

    let user = await userController.view(Number(user_id));
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user.display_name,
    });
});

routes.get('/:user_id', async(req, res) => {
    let {user_id} = req.params;

    if(!user_id) {
        return res.status(400).send("No user id");
    }

    let user = await userController.publicView(Number(user_id));
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user,
    });
});

routes.get('/username/:username', async(req, res) => {
    let {username} = req.params;

    if(!username) {
        return res.status(400).send("No user id");
    }

    let user = await userController.publicViewByUsername(username);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user,
    });
});