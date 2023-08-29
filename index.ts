import express, { NextFunction } from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Socket, Server } from 'socket.io';
import cors from 'cors';import _ from 'lodash';
import path from 'path';
import dotenv from 'dotenv';
import { getServerPort, verifySignature } from './utils';
import { routes as userRoutes } from './src/Routes/user';
import { routes as reservationRoutes } from './src/Routes/reservation';
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
app.use(bodyParser.json());
app.use(cors({
    origin: whitelists,
    credentials: true
}));

app.use((req, res, next) => {
    // we need to check the multipart in their respective paths
    if(req.is('multipart/form-data')) {
        next();
        return;
    }
    const { address, signature } = req.body;
    if(!signature || !address) {
        console.log('no signature or address')
        return res.status(400).send('Invalid params');
    }

    let verified = verifySignature(address, signature, VERIFY_MESSAGE);
    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    next();
});

app.use('/user', userRoutes);
app.use('/reservation', reservationRoutes);

//connect app to websocket
let http = createServer(app);
/* let io = new Server(http, {
    cors: {
        origin: whitelists,
        credentials: true
    }
}); */

//websocket functions
/* io.on('connection', (socket: Socket) => {
    
}); */

//api endpoints
app.get('/', function(req, res) {
    res.send('Hello World');
});

// start the server
http.listen(port, () => {
    console.log("I'm alive!");
});


// init cron jobs
cron.init();