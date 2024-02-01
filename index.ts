import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Socket, Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import cors from 'cors';import _ from 'lodash';
import path from 'path';
import dotenv from 'dotenv';
import { getServerPort, verifySignature } from './utils';
import { routes as userRoutes } from './src/Routes/user';
import { routes as reservationRoutes } from './src/Routes/reservation';
import { routes as webhookRoutes } from './src/Routes/webhook';
import { routes as gitgudRoutes } from './src/Routes/gitgud';
import { routes as mailRoutes } from './src/Routes/mail';
import { routes as mailingListRoutes } from './src/Routes/mailingList';
import { routes as contentRoutes } from './src/Routes/content';
import { routes as contentPassRoutes } from './src/Routes/contentPass';
import { routes as handleWebhookRoutes } from './src/Routes/handleWebhook';
import * as cron from './src/Cron';
import { VERIFY_MESSAGE } from './src/Constants';

dotenv.config({ path: path.join(__dirname, '.env')});

process.on('uncaughtException', function (err) {
    //dont stop on uncaught exception
    console.log('Caught exception: ', err);
});

//create app
const port = getServerPort();
const whitelists = JSON.parse(process.env.CORS_WHITELIST!);

let app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use((req, res, next) => {
    // check if it's a handleWebhook request
    if(req.path.match(/\/handleWebhook\/sphere/g)) {
        next();
        return;
    }

    // check if it's to reserve a time slot
    if((req.path.match(/\/reservation\//g) && req.method.toLowerCase() === "get")|| req.path.match(/\/reservation\/new\/.*/g)) {
        next();
        return;
    }
    // check if it's to subscribe to mailing list
    if((req.path.match(/\/mailingList\//g) && req.method.toLowerCase() === "get")|| req.path.match(/\/mailingList\/subscribe/g)) {
        next();
        return;
    }
    
    // check if it's to post new issue
    if(req.path.match(/\/gitgud\/newIssue/g)) {
        next();
        return;
    }

    // check if it's getting public methods
    if(req.path.match(/\/user\//g) && req.method.toLowerCase() === "get") {
        next();
        return;
    }

    // check if it's getting public methods
    if(req.path.match(/\/public\//g)) {
        next();
        return;
    }

    // check if it's posting new email
    if(req.path.match(/\/mail\//g)) {
        next();
        return;
    }
    
    // check if it's getting public methods
    if(req.path.match(/\/gitgud\//g) && req.method.toLowerCase() === "get") {
        next();
        return;
    }

    // we need to check the multipart in their respective paths
    if(req.is('multipart/form-data')) {
        next();
        return;
    }

    const { address, signature, message } = req.body;
    if(!signature || !address) {
        return res.status(400).send('Invalid params');
    }

    let verified = verifySignature(address, signature, message ?? VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    next();
});

app.use('/user', userRoutes);
app.use('/reservation', reservationRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/gitgud', gitgudRoutes);
app.use('/mail', mailRoutes);
app.use('/mailingList', mailingListRoutes);
app.use('/content', contentRoutes);
app.use('/contentPass', contentPassRoutes);
app.use('/handleWebhook', handleWebhookRoutes);

//connect app to websocket
let http = createServer(app);

let io = new Server(http, {
    cors: {
        origin: "*",
        credentials: true
    }
});

//websocket functions
io.on('connection', (socket: Socket) => {
    // from local server connection
    socket.on('update_reservation_payment_status', ({uuid, status}: { uuid: string; status: number }) => {
        // console.log('server', `update received`);
        // console.log(`emitting to ${uuid}, status = ${status}`);
        io.emit(uuid, { status });
    });

    socket.on('update_mail_payment_status', ({tiplink_public_key, isPaid}: { tiplink_public_key: string; isPaid: boolean }) => {
        // console.log('server', `update received`);
        // console.log(`emitting to ${uuid}, status = ${status}`);
        io.emit(tiplink_public_key, { isPaid });
    });

    socket.on('update_content_payment_status', ({address}: { address: string; }) => {
        io.emit(`content_${address}`, "Paid");
    });
    
});

instrument(io, {
    auth: false
    // {
    //   type: "basic",
    //   username: "admin",
    //   password: "$2b$10$heqvAkYMez.Va6Et2uXInOnkCT6/uQj1brkrbyG3LpopDklcq7ZOS" // "changeit" encrypted with bcrypt
    // },
});

//websocket functions
/* io.on('connection', (socket: Socket) => {
    
}); */

//api endpoints
app.get('/', function(req, res) {
    res.send('Hello World');
});

// start the server
http.listen(port, () => {
    console.log(`I'm alive! Port: ${port}`);
});


// init cron jobs
cron.init();