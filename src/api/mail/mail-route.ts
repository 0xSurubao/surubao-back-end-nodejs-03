// base
import { Express, Request, Response } from "express";

// third
import { WriteResult } from "firebase-admin/firestore";

// from project
import { _pushNotificationService } from "../../features/push-notification-service/push-notification-service";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
import { _mailService, MailService } from "../../features/mail-service/mail-service";


export async function SetupRoute(baseExpressApp: Express)
{
    baseExpressApp.patch('/mail', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        const markAsReadRequest: MarkAsReadRequest = request.body as MarkAsReadRequest;

        // console.log("#> MailsIdsList = ");
        // console.log(MailsIdsList);
        // console.log("#> authHeader = ");
        // console.log(authHeader);
        // console.log("#> request.headers = ");
        // console.log(request.headers);

        let isAuthenticated: boolean = false;
        let isValidOperation: boolean = markAsReadRequest.Action == 'mark-as-read';

        let responseObject: MarkAsReadResponse =
        {
            MailsIdsList: markAsReadRequest.MailsIdsList,
        }

        if (authHeader && isValidOperation)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                let data = await MailService.GetMailsDocument(userId);

                if (data)
                {
                    data.MailsList.map(
                        (mail) =>
                        {
                            if (markAsReadRequest.MailsIdsList.includes(mail.Id))
                                mail.WasRead = true;
                        });
                }

                await MailService.SetMailsDocument(userId, data);

                response.status(200).send(responseObject);
            }
        }

        if (!isAuthenticated || !isValidOperation)
        {
            console.log("$$$ > isAuthenticated OR isValidOperation is FALSE!");
            response.status(401).send(responseObject);
        }
    });

    baseExpressApp.patch('/notification-token', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        const registerNotificationRequest: RegisterNotificationRequest = request.body as RegisterNotificationRequest;

        let isAuthenticated: boolean = false;
        let isValidOperation: boolean = registerNotificationRequest.Action == 'register-notification-token';

        let responseObject: RegisterNotificationResponse = {
            Success: false,

            Action: registerNotificationRequest.Action,
            ClientToken: registerNotificationRequest.ClientToken,
            ErrorsList: [],
        }

        if (authHeader && isValidOperation)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                await _pushNotificationService.RegisterNotificationToken(
                    userId,
                    registerNotificationRequest.ClientToken);

                responseObject.Success = true;

                response.status(200).send(responseObject);
            }
        }

        if (!isAuthenticated || !isValidOperation)
        {
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });
}






interface MarkAsReadRequest
{
    Action: string,
    MailsIdsList: string[],
}

interface MarkAsReadResponse
{
    MailsIdsList: string[],
}

interface RegisterNotificationRequest
{
    Action: string,
    ClientToken: string,
}

interface RegisterNotificationResponse
{
    Success: boolean,
    Action: string,
    ClientToken: string,
    ErrorsList: string[],
}

// {
//     host: 'localhost:2829',
//     'user-agent': 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Mobile Safari/537.36',  accept: 'application/json, text/plain, */*',
//     'accept-language': 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3',
//     'accept-encoding': 'gzip, deflate, br',
//     'content-type': 'application/json',
//     'content-length': '47',
//     origin: 'http://localhost:4200',
//     connection: 'keep-alive',
//     referer: 'http://localhost:4200/',
//     'sec-fetch-dest': 'empty',
//     'sec-fetch-mode': 'cors',
//     'sec-fetch-site': 'same-site'
//   }
