import { Router } from 'express';
import * as controller from '../Controllers/webhookController';
import * as userController from '../Controllers/userController';
import _ from 'lodash';
import { convertBigIntToString } from '../../utils';

export const routes = Router();

// create
routes.post('/', async(req, res) => {
    let data = req.body;
    let {address, signature} = data;

    if(!data) {
        return res.status(400).send("No data");
    }

    if(!data.address) {
        return res.status(400).send("Invalid params");
    }

    let users = await userController.find({ address });
    if(!users || users.length === 0) {
        return res.send({
            success: false,
            message: "Unable to find user",
        });
    }

    const result = convertBigIntToString(await controller.create({...data, user_id: users[0].id}));

    return res.json({ success: true, data: result });
});

// update
// have to use POST to update (because multer does not support PUT)
routes.post('/update/:id', async(req, res) => {
    let data = req.body;

    try {
        await controller.update(parseInt(req.params.id), data);
        return res.json({ success: true });
    }

    catch(e: any) {
        if(e.message === "Unauthorized") {
            return res.status(401).send("Unauthorized");
        }

        return res.status(500);
    }
});

// update
// have to use POST to update (because multer does not support PUT)
routes.post('/test/:id', async(req, res) => {
    try {
        await controller.test(parseInt(req.params.id));
        return res.json({ success: true });
    }

    catch(e: any) {
        if(e.message === "Missing webhook") {
            return res.status(404).send("Missing webhook");
        }

        return res.status(500);
    }
});