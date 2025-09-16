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


export default class WebhookSuitpay
{
    static SetupRoute = async (baseExpressApp: Express) =>
    {
        baseExpressApp.post('/api/v1/webhook/suitpay', async (request: Request, response: Response) =>
        {
            let requestBody: PaymentWebhookRequestBody = request.body as PaymentWebhookRequestBody;

            console.log(
                '### webhook/suitpay' + '\n',
                '\n',
                'requestBody.statusTransaction = ',
                requestBody.statusTransaction, '\n',
                '\n',
                'request.body = ' + '\n',
                request.body,
            )

            let success = false;

            switch (requestBody.typeTransaction)
            {

            case 'PIX':
                {
                    switch (requestBody.statusTransaction)
                    {

                    case 'PAID_OUT':
                        {
                            success = await PaymentService.FinishItemPurchaseRequest(
                                requestBody.requestNumber,
                                requestBody.idTransaction);

                            console.log('# webhook/suitpay | success = ' + success);
                            break;
                        }

                    default:
                        {
                            console.error(
                                '$$$> UNEXPECTED statusTransaction!!!' + '\n',
                                '\n',
                                'requestBody.statusTransaction = ',
                                requestBody.statusTransaction, '\n',
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
                        '$$$> UNEXPECTED typeTransaction!!!' + '\n',
                        '\n',
                        'requestBody.typeTransaction = ',
                        requestBody.typeTransaction, '\n',
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


export interface PaymentWebhookRequestBody
{
    hash: string, // 'ca0714c62df09fb7d7bec34779e86f022090336c9eb3ae50432ffd9e401a72d5'
    idTransaction: string, // 'cd9da65d-c456-4582-bbe7-887a9580cb4a',
    payerName: string, // 'SuitPay Teste'
    payerTaxId: string, // '23876508088'
    paymentCode: string, // '00020101021226890014br.gov.bcb.pix2567brcode-h.sandbox.starkinfra.com/v2/0dfa6e21b0dd45bbaa0285b71f783c375204000053039865802BR5918Suit Business Ltda6007Goiania62070503***63044603'
    paymentDate: string, // '18/06/2024 18:57:56'
    requestNumber: string, // '16aef80c-8c6c-4c27-9a64-bedbbfc9ad33'
    statusTransaction: string, // 'PAID_OUT'
    typeTransaction: string, // 'PIX'
    value: number // 5
}
