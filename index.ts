import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Socket, Server } from 'socket.io';
import cors from 'cors';import _ from 'lodash';
import path from 'path';
import dotenv from 'dotenv';
import { getServerPort } from './utils';
import { routes as onchainRoutes } from './src/Routes/user';
import { routes as userRoutes } from './src/Routes/user';
import * as cron from './src/Cron';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { base64 } from 'ethers/lib/utils';

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
    const message = `This message is to prove that you're the owner of this address!`;
    const { address, signature } = req.body;
    
    if(!signature || !address) {
        console.log('no signature or address')
        return res.status(400).send('Invalid params');
    }

    const verified = nacl
            .sign
            .detached
            .verify(
                new TextEncoder().encode(message),
                base64.decode(signature),
                bs58.decode(address)
            );

    if(!verified) {
        return res.status(401).send("Unauthorized");
    }

    next();
});
app.use('/onchain', onchainRoutes);
app.use('/user', userRoutes);

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