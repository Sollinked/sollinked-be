import { Router } from 'express';
import * as userController from '../Controllers/userController';

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