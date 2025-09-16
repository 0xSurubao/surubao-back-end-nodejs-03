// base
// import fetch from 'node-fetch';
// import { RequestInit } from 'node-fetch';
import axios, { AxiosRequestConfig } from 'axios';
// import http from "node:http";
import { v4 as uuidv4 } from 'uuid';

// from project
import { UserRegisterRequest } from "../../auth-service/auth-service";
import { GetDocData, SetDocData } from '../../firebase-admin/firebase-admin';
import { _pushNotificationService, PushNotificationToken, PushNotificationEntry, PushNotificationServce as PushNotificationService } from '../../push-notification-service/push-notification-service';
import { _timeService, TimeService } from "../../time-service/time-service";
import { _usersService, PublicUserProfileDocument } from "../../users-service/users-service";
import { PaymentService } from '../../payment-service/payment-service';
import { WithdrawParameters } from '../../store-service/store-service';


export class SuitpayPaymentIntegrationService
{
    static Fetch = async (method: string, endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        let url = process.env.PARTNER_SUITPAY_API_BASE_URL! + '/' + endPoint;

        let requestHeaders =
        {
            'ci': process.env.PARTNER_SUITPAY_AUTH_CLIENT_ID!,
            'cs': process.env.PARTNER_SUITPAY_AUTH_CLIENT_SECRET!,
        };

        // let initOptions: RequestInit =
        // {
        //     method: method,
        //     headers: requestHeaders,
        //     body: JSON.stringify(requestBody),
        // }

        let config: AxiosRequestConfig =
        {
            url: url,
            method: method,
            headers: requestHeaders,
            data: requestBody,
        }

        // https://sandbox.ws.suitpay.app/api/v1/gateway/request-qrcode

        await axios.request(config)
            .then(
                (response) =>
                {
                    if (!response)
                    {
                        console.error(
                            'ERROR trying to ' + method + '!' + '\n' +
                            'url = ' + url + '\n' +
                            'response = ' + '\n',
                            response,
                        )
                    }

                    responseBody = response;
                })
            .catch(
                (error) =>
                {
                    console.error(
                        '$ > ERROR trying to axios.request' + "\n" +
                        'url = ', url, '\n' +
                    'requestBody = ',
                        requestBody, '\n' +
                    'requestHeaders = ',
                        requestHeaders,
                        '',
                    );
                    console.error(error);
                })

        // const response = await fetch(url, initOptions);
        // responseBody = await response.json();

        // if (!responseBody)
        // {
        //     console.error(
        //         'ERROR trying to ' + method + '!' + '\n' +
        //         'url = ' + url + '\n' +
        //         'response = ' + '\n',
        //         response,
        //     )
        // }

        return responseBody;
    }

    static Post = async (endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        responseBody = await SuitpayPaymentIntegrationService.Fetch('POST', endPoint, requestBody);

        return responseBody;
    }

    static Patch = async (endPoint: string, requestBody: any) =>
    {
        let responseBody: any = undefined;

        responseBody = await SuitpayPaymentIntegrationService.Fetch('PATCH', endPoint, requestBody);

        return responseBody;
    }


    static CreatePixPayment = async (
        value: number,
        userFullname: string,
        userIdDocument: string,
        userEmail: string,
        purchaseInternalId: string,
    ): Promise<SuitPayCreatePixPaymentResponseBody> =>
    {
        // await SuitpayPaymentIntegrationService.SetupWebHookUrl();

        let expirationInMinutes = 5;
        let expirationInSeconds = expirationInMinutes * 60;

        let webhookUrl = process.env.WEBHOOK_ENDPOINT! + '/api/v1/webhook/suitpay';

        console.log('webhookUrl = ', webhookUrl);


        let requestBody =
        {
            "requestNumber": purchaseInternalId,
            "dueDate": "2024-06-18",
            "amount": value,
            // "shippingAmount": 0.0,
            // "discountAmount": 0.0,
            // "usernameCheckout": "checkout",
            "callbackUrl": webhookUrl,
            "client": {
                "name": userFullname,
                "document": userIdDocument,
                // "phoneNumber": "62999815500",
                "email": userEmail,
                // "address": {
                //     "codIbge": "5208707",
                //     "street": "Rua Paraíba",
                //     "number": "150",
                //     "complement": "",
                //     "zipCode": "74663-520",
                //     "neighborhood": "Goiânia 2",
                //     "city": "Goiânia",
                //     "state": "GO"
                // }
            },
            // "products": [
            //     {
            //         "description": "Tênis",
            //         "quantity": 1,
            //         "value": 200.0
            //     },
            //     {
            //         "description": "Camiseta M",
            //         "quantity": 2,
            //         "value": 50.0
            //     }
            // ],
        };

        let responseBody: SuitPayCreatePixPaymentResponseBody =
            await SuitpayPaymentIntegrationService.Post(
                'gateway/request-qrcode',
                requestBody);

        if (responseBody)
        {
            // console.log(
            //     '############ responseBody = ',
            //     responseBody,
            // );

            if (responseBody.data.response == 'OK')
            {
                // console.log('# pix creation has been succeed!');
            }
            else
            {
                console.error(
                    '$$$ > Suitpay | CreatePixPayment failed!' + '\n' +
                    'responseBody = ' + '\n',
                    responseBody,
                );
            }
        }

        return responseBody;
    }

    // static FAKE_CreatePixPayment = async (
    //     value: number,
    //     userFullname: string,
    //     userIdDocument: string,
    //     purchaseInternalId: string,
    // ): Promise<SuitPayCreatePixPaymentResponseBody> =>
    // {
    //     let fakePurhcaseId = 'FAKE-' + uuidv4() + '-FAKE';

    //     let responseBody: SuitPayCreatePixPaymentResponseBody =
    //     {
    //         message: 'Pagamento PIX gerado com sucesso.',
    //         "data": {
    //             "qr_code_url": 'https://google.com',
    //             "favoured": 'https://google.com',
    //             "external_reference": fakePurhcaseId,
    //             "checkout": '',
    //             "pix_key": fakePurhcaseId,
    //         }
    //     };

    //     SuitpayPaymentIntegrationService.FAKE_SendFakeConfimationAsync(purchaseInternalId);

    //     return responseBody;
    // }

    static FAKE_SendFakeConfimationAsync = async (
        purchaseInternalId: string,
        externalTransactionId: string,
    ) =>
    {
        // let waitSeconds = 3;
        // await Delay(waitSeconds);

        await PaymentService.FinishItemPurchaseRequest(purchaseInternalId, externalTransactionId);
    }

    static CreatePixWithdraw = async (
        withdrawValue: number,
        withdrawParameters: WithdrawParameters,
        userIdDocument: string,
    ): Promise<SuitPayCreatePixWithdraResponseBody> =>
    {
        // await SuitpayPaymentIntegrationService.SetupWebHookUrl();

        let expirationInMinutes = 5;
        let expirationInSeconds = expirationInMinutes * 60;

        let webhookUrl = process.env.WEBHOOK_ENDPOINT! + '/api/v1/webhook/suitpay';

        console.log('webhookUrl = ', webhookUrl);


        let requestBody =
        {
            "value": withdrawValue,
            "key": withdrawParameters.WithdrawPixKey,
            "typeKey": withdrawParameters.WithdrawPixKeyType, // 'document' / 'phoneNumber' / 'randomKey' / 'email'
            // "callbackUrl": "https://webhook.com",
            "documentValidation": userIdDocument,
        };

        let responseBody: SuitPayCreatePixWithdraResponseBody =
            await SuitpayPaymentIntegrationService.Post(
                // 'gateway/pix-payment', // ! TODO: TEST 500 STATUS FORCING!!!
                'gateway/pix-payment',
                requestBody);

        if (responseBody)
        {
            console.log(
                '############ CreatePixWithdraw | responseBody = ',
                responseBody,
            );

            if (responseBody.data.response == 'OK')
            {
                console.log('# CreatePixWithdraw | pix withdraw has been succeed!');
            }
            else
            {
                console.error(
                    '$$$ > Suitpay | CreatePixWithdraw failed!' + '\n' +
                    'responseBody = ' + '\n',
                    responseBody,
                );
            }
        }

        return responseBody;
    }
}

export const Delay = (waitSeconds: number) => new Promise(res => setTimeout(res, waitSeconds * 1000));

export interface AccessToken 
{
    access_token: string,
    expires_in: Date,
    refresh_token: string,
    admin_type: 1
}

export interface ResponseBody 
{
    message: string,
    data: any,
}

export interface CreatePixResponse
{
    "qr_code_url": string,
    "favoured": string,
    "external_reference": string,
    "checkout": string,
    "pix_key": string,
}

export interface SuitPayCreatePixPaymentResponseBody
{
    status: number,// 200
    statusText: string, // 'OK'
    data: {
        idTransaction: string, // "677d9309-db6c-43d0-b08b-d4049158b6e1",
        paymentCode: string, // "00020101021226890014br.gov.bcb.pix2567brcode-h.sandbox.starkinfra.com/v2/bf4e3148cbfa4a26a5183e23c7edee7d5204000053039865802BR5918Suit Business Ltda6007Goiania62070503***63043DF3",
        response: string, // "OK",
        paymentCodeBase64: string, // "iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6AQAAAACgl2eQAAACy0lEQVR4Xu2XQXLsIAwF4SJw/1v8o8BFcLpFEjtepP4i1sqUZ+yBnqo30pNgyvH7+FfuM7fxAnu8wB4vsMf/AaOUeoxW+mq8jeL7jMk8YHLFxFx1ztU6n6qTmUB8PEYfrbXOrR6QezITYI1gESDWjlUQmg9wI0KLaEGh92syDeAiSbHM2lJgTCYC4ZX7uLv6vv7HQIxVR1PaQCLV0z+ns4BBhszR9L2ubVz9mwgsZi1YZkjZsIb5vFxPA8wLkLGqNpB4opP9yObDgB7FsMaHpWkNo7W0TABpVquTOtVewlcOX2kAuWnV9W4X8Unl+5YFIBGzxm7ikMQ8eCYVKBbKZ7GEe6dhygRUiGlCZEBzGqezmScAOJZa3a1jobXfizcD0DLdLkbISjdwRfTbtBmA4anh0uBQWZpMJhBbCdmidrc6snYt3gRg8RQCkUnCiNVO2bfIBACzsK21nSVkhnnLtbKeB5a1aunaP1lkTzFyqYBzIWpGW7ex+3AWbwJgtgxRU9uIDdWZi2mfB0wWNetBAw7b1Djt/MzmwwATHU0YlRWjRvq077fIFIBc9cOiHd56mLhawGnAKNbq6LGJwJI1PGM95wGH+Wr0sBA7dXFIPE2bACBIYcz7atrHdGUC6uEyZ5w8e+wn3ZglAh72dMjSKW3XUL9u7gkAe9qMDlKjZIjYMG90k0SgaJOIC941QB441lm8CcCK1mHXIlkzDhe36n4esG1omGayXOv2kuMs3gQgjGKmQmH3G1KXX5EA2EUrLg21ETEVH44sgBTZRyNKeIetpX6pTgMcuhW5GoYY+XDd/Z8HhoKoFZuYsVo6mFSdv+J5QKe4s+1DDgdOSsnYKT4NUNs2DHLxsKUcMpMBKsbYLM/dztnHkoFp90Scq0vj7vU8QAZxpIebf447QeNKBCIzmMRMaR1CZv+wktKA38YL7PECe7zAHn8AfADi9i1FwyTCIAAAAABJRU5ErkJggg==",
    }
}

export interface SuitPayCreatePixWithdraResponseBody
{
    status: number,// 200
    statusText: string, // 'OK'
    data: {
        idTransaction: string, // "10dc395c-bee0-4368-a980-85a610987e30",
        response: string, // "OK",
    }
}
