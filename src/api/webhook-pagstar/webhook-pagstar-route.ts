// base
import { Express, Request, Response } from "express";

// third
import { WriteResult } from "firebase-admin/firestore";

// from project
import { _pushNotificationService } from "../../features/push-notification-service/push-notification-service";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
import { _mailService } from "../../features/mail-service/mail-service";
import { AnimalService } from "../../features/animals-service/animals-service";
import { StoreService } from "../../features/store-service/store-service";
import { PaymentService } from "../../features/payment-service/payment-service";


export default class WebhookPagstar
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        baseExpressApp.post('/api/v1/webhook/pagstar', async (request: Request, response: Response) =>
        {
            // const { title, content } = request.body as TestNotificationRequest;

            // let clientsTokens: string[] = [
            //     // 'fg3oorz6yNx3gUoJuKcLU9:APA91bHKSm1EuI01czx6sR5V9vIGrvJF4_FJMV4m2bt4aso9qpHchyCsTntjOzfXDoDGMqHlf7lxKo07YLvdB3UQ4qZs5VlAqNEkexqGn6pMgJO2BztnJlLSDqHRVNq36dH3twMa6P2E',
            //     'fg3oorz6yNx3gUoJuKcLU9:APA91bHJ0bOsVjdA_-FKvXZTZ60j4fNZC8_hkbHbeQXmgj-0LoAYWlnuYevxtBhTaXSsQautaBvpa3bVSzs_998QWVhK3xJ9AOWe0PzaGcviB6Mw4CVNPfv4pch1mLKRM2dgX-CXw6JJ',
            // ];

            // await _pushNotificationService.SendNotifcation(clientsTokens, title, content);


            // TODO: REVIEW THIS!!!
            // TODO: REVIEW THIS!!!
            // TODO: REVIEW THIS!!!
            // await AnimalService.RegisterAnimalBuy(userId, availableAnimalSlot, animalItem, userAnimalsDocument);

            // SendPurchaseConfimationAsyn(responseObject.AnimalItemId);
            // TODO: REVIEW THIS!!!
            // TODO: REVIEW THIS!!!
            // TODO: REVIEW THIS!!!

            let requestBody: PaymentNotificationRequestBody = request.body as PaymentNotificationRequestBody;

            console.log(
                '### webhook/pagstar' + '\n',
                '\n',
                'requestBody.status = ',
                requestBody.status, '\n',
                '\n',
                'request.body = ' + '\n',
                request.body,
            )

            let success = false;

            switch (requestBody.type)
            {

            case 'pay':
                {
                    switch (requestBody.status)
                    {

                    case 'approved':
                        {
                            success = await PaymentService.FinishItemPurchaseRequest(
                                requestBody.transaction_id,
                                requestBody.external_reference,
                            );

                            console.log('# webhook/pagstar | success = ' + success);
                            break;
                        }
                    default:
                        {
                            console.error(
                                '$$$> UNEXPECTED PaymentStatus!!!' + '\n',
                                '\n',
                                'requestBody.status = ',
                                requestBody.status, '\n',
                                '\n',
                                'request.body = ' + '\n',
                                request.body,
                            )
                            break;
                        }
                    }

                    break;
                }

            default:
                {
                    console.error(
                        '$$$> UNEXPECTED PaymentType!!!' + '\n',
                        '\n',
                        'requestBody.type = ',
                        requestBody.type, '\n',
                        '\n',
                        'request.body = ' + '\n',
                        request.body,
                    )
                    break;
                }
            }

            if (success)
                response.status(201).send({});
            else
                response.status(404).send({});
        });
    }
}


export interface PaymentNotificationRequestBody 
{
    status: string,
    type: string,
    value: number,
    external_reference: string,
    transaction_id: string,
    created_at: string,
    updated_at: string,
}

export enum PaymentStatus
{
    approved,
}

export enum PaymentType
{
    pay,
}

// {
//     status: 'approved',
//     type: 'pay',
//     value: 5,
//     external_reference: 'ecae113c-4219-40c1-89cb-53a4c59a7009',
//     transaction_id: '932bd1bc-dd78-4275-9a30-b4dbba0f65eb',
//     created_at: '2024-05-08T03:42:28.000000Z',
//     updated_at: '2024-05-08T03:42:28.000000Z'
// }
