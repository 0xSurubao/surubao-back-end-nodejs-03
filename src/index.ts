// base/core
import dotenv from "dotenv";
import * as http from "http"
import express, { Request, Response, Express } from "express";
import { FirebaseApp, SetDocData } from './features/firebase-admin/firebase-admin';

// from project
import * as MailRoute from "./api/mail/mail-route";
import * as StoreRoute from "./api/store/store-route";
import * as HealthRoute from "./api/health/HealthRoute";
import * as AcitivityRoute from "./api/acitivity/acitivity-route";
import * as AuthRoute from "./api/auth/auth-route";
import TestRoute from "./api/_TEST/test-route";
import { Server, Socket } from "socket.io";
import { StoreConfigDocument, AnimalStoreItem } from './features/store-service/store-service';
import { _timeService } from './features/time-service/time-service';
import { AddressInfo } from "net";
import WebhookPagstar from "./api/webhook-pagstar/webhook-pagstar-route";
import WebhookSuitpay from "./api/webhook-suitpay/webhook-suitpay-route";
import AdminRoute from "./api/admin/admin-route";
import WithdrawRoute from "./api/withdraw/withdraw-route";
import { _appConfigService } from "./features/app-config-service/app-config-service";
import AdminToolsRoute from "./api/admin/tools/tools-route";
import { DataMigrationsHandler } from "./features/data-migrations-handler/data-migrations-handler";
import { EnvironmentHandler } from "./features/environment-handler/environment-handler";


dotenv.config();

const expressApp: Express = express();
const cors = require('cors');
const httpServer = http.createServer(expressApp);

let _io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
> = new Server(httpServer, { cors: { origin: '*' } });


expressApp.use(express.json());
expressApp.use(cors());
AuthRoute.SetupRoute(expressApp);
MailRoute.SetupRoute(expressApp);
StoreRoute.SetupRoute(expressApp, _io);
HealthRoute.SetupRoute(expressApp);
AcitivityRoute.SetupRoute(expressApp);
WithdrawRoute.SetupRoute(expressApp);

WebhookPagstar.SetupRoute(expressApp);
WebhookSuitpay.SetupRoute(expressApp);

AdminRoute.SetupRoute(expressApp);
AdminToolsRoute.SetupRoute(expressApp);

TestRoute.SetupRoute(expressApp)
// EnvironmentHandler.DoIfIsLocal(() => TestRoute.SetupRoute(expressApp));

let onMigractionsFinishCallback = () =>
{
    StartHttpServer();
    StartWebSocketServer();
    // TryToStartLocalTunnel();
}

DataMigrationsHandler.HandleDataMigrations(onMigractionsFinishCallback);

let StartHttpServer = () =>
{
    let server = httpServer.listen(
        process.env.API_PORT || 2829,
        () => 
        {
            let host = (server.address()! as AddressInfo).address;
            let port = (server.address()! as AddressInfo).port;

            console.log("##### RUNNING! (", host + ':' + port, " | http://localhost:" + process.env.API_PORT + ") #####");
            _timeService.TryToSubscribeAllListeners();
            _appConfigService.TryToSubscribeAllListeners();
        }
    );
}

let StartWebSocketServer = () =>
{
    _io.on(
        "connection", (socket: Socket) =>
    {
        // console.log("### > connection | socket.id = " + socket.id)

        socket.on("enter-purchase-room", (data: string) =>
        {
            // console.log("### > enter-purchase-room | data = " + data)
            socket.join(data);
        });

        socket.on("disconnect", (reason) =>
        {
            // console.log("### > disconnect | socket.id = " + socket.id)
        });
    });
}

let TryToStartLocalTunnel = () =>
{
    EnvironmentHandler.DoIfIsLocal(
        () =>
        {
            const localtunnel = require('localtunnel');

            (async () =>
            {
                const tunnel = await localtunnel({ port: process.env.API_PORT || 2829 });

                // the assigned public url for your tunnel
                // i.e. https://abcdefgjhij.localtunnel.me
                process.env.WEBHOOK_ENDPOINT = tunnel.url;

                console.log('tunnel.url = ', tunnel.url);
                console.log('process.env.WEBHOOK_ENDPOINT = ', process.env.WEBHOOK_ENDPOINT);

                tunnel.on('close', () =>
                {
                    // tunnels are closed
                });
            })();
        });
}








interface ServerToClientEvents
{
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
}

interface ClientToServerEvents
{
    hello: () => void;
}

interface InterServerEvents
{
    ping: () => void;
}

interface SocketData
{
    name: string;
    age: number;
}
