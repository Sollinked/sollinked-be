import { Router } from 'express';
import * as userController from '../Controllers/userController';
import * as userTierController from '../Controllers/userTierController';
import * as userTagController from '../Controllers/userTagController';
import * as userReservationSettingController from '../Controllers/userReservationSettingController';
import * as contentCNFTController from '../Controllers/contentCNFTController';
import { contentUpload } from './Upload';
import { checkAllowedMime, getAddressNftDetails, getApiKey, getContentPassCollectionAddress, getMd5, verifySignature } from '../../utils';
import fs from 'fs-extra';
import _ from 'lodash';
import { VERIFY_MESSAGE } from '../Constants';
import { ContentCNFT } from '../Models/contentCNFT';
import DB from '../DB';
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
    
    let result = await userController.create({
        address: data.address,
        username: data.username,
        calendar_advance_days: 100
    });

    if(!result) {
        return res.status(500).send("Server Error");
    }

    let users = await userController.find({ id: result.id });

    if(!users || users.length === 0) {
        return res.status(500).send("Server Error");
    }

    return res.send({
        success: true,
        message: "Success",
        data: users[0],
    });
});

routes.post('/update/:id', contentUpload.single('profile_picture'), async(req, res) => {
    let data = req.body;
    let {address, signature, message} = data;
    let id = parseInt(req.params.id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
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
    let {address, signature, message} = data;
    let user_id = parseInt(req.params.user_id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.tiers) {
        return res.status(400).send("Invalid params");
    }

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
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

    catch(e: any) {
        let db = new DB();
        await db.log('user', '/updateTiers/:user_id', e.toString());

        return res.status(500).send("Unable to update tier");

    }

    return res.send({
        success: true,
        message: "Success",
    });
});

routes.post('/updateReservationSettings/:user_id', async(req, res) => {
    let data = req.body;
    let {address, signature, message} = data;
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

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
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

    catch(e: any) {
        let db = new DB();
        await db.log('user', '/updateReservationSettings/:user_id', e.toString());

        return res.status(500).send("Unable to update user reservation settings");

    }

    return res.send({
        success: true,
        message: "Success",
    });
});

// currently only whale tags
routes.post('/updateTags/:user_id', async(req, res) => {
    let data = req.body;
    let {address, signature, message, tags, hash } = data;
    let user_id = parseInt(req.params.user_id);

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address || !data.tags || !data.hash) {
        return res.status(400).send("Invalid params");
    }

    let verifyHash = getMd5(JSON.stringify(tags));

    // not verified tags update
    // need this cause we want to make sure the user's price labels are good
    // since everything is on client side
    if(verifyHash !== hash) {
        return res.status(401).send("Unauthorized");

    }

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
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
        await userTagController.updateByUserId(user_id, data.tags);
    }

    catch(e: any) {
        let db = new DB();
        await db.log('user', '/updateTags/:user_id', e.toString());

        return res.status(500).send("Unable to update tier");

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
    
    let user = await userController.findByAddress(data.address);
    if(!user) {
        return res.status(404).send("Unable to find user.");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user
    });
});
routes.post('/me/content_passes', async(req, res) => {
    let data = req.body;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }
    
    let addressCNFTs = await getAddressNftDetails(true, data.address);
    let contentCNFTs: ContentCNFT[] | undefined = [];
    if(addressCNFTs.items.length > 0) {
        let collectionMintAddress = getContentPassCollectionAddress();
        let addressContentPasses = addressCNFTs.items.filter(x => x.grouping.length > 0 && x.grouping[0].group_value === collectionMintAddress);
        let contentPassMintAddresses = addressContentPasses.map(x => x.id);
        contentCNFTs = await contentCNFTController.find({ mint_address: contentPassMintAddresses });
    }
    return res.send({
        success: true,
        message: "Success",
        data: contentCNFTs ?? [],
    });
});

// public routes
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

routes.get('/homepageUsers', async(req, res) => {
    let users = await userController.getHomepageUsers();
    if(!users) {
        return res.status(404).send("Unable to find users");
    }

    return res.send({
        success: true,
        message: "Success",
        data: users,
    });
});

routes.get('/username/:username', async(req, res) => {
    let {username} = req.params;

    if(!username) {
        return res.status(400).send("No username");
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

routes.get('/search/:username', async(req, res) => {
    let {username} = req.params;

    if(!username) {
        return res.status(400).send("No user id");
    }

    let user = await userController.search(username);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user,
    });
});

routes.get('/searchAddress/:address', async(req, res) => {
    let {address} = req.params;

    if(!address) {
        return res.status(400).send("No user id");
    }

    let user = await userController.searchAddress(address);
    if(!user) {
        return res.status(404).send("Unable to find user");
    }

    return res.send({
        success: true,
        message: "Success",
        data: user,
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