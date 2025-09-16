// base
import { Express, Request, Response } from "express";
import { GetUserIdByToken, GetDocData, SetDocData } from '../../features/firebase-admin/firebase-admin';
import { WriteResult } from "firebase-admin/firestore";
import { Server } from "socket.io";
import { AnimalStoreItem, SlotStoreItem, StoreConfigDocument, StoreService } from '../../features/store-service/store-service';

// from project
import { _storeService } from "../../features/store-service/store-service";
import { _animalService, AnimalService } from "../../features/animals-service/animals-service";
import { Delay } from "../../features/utils/project-utils";
import { v4 as uuidv4 } from 'uuid';
import { _timeService } from "../../features/time-service/time-service";
import { IncomesService, AnimalSellResult } from '../../features/incomes-service/incomes-service';
import { PagstarCreatePixPaymentResponseBody, PagstarPaymentIntegrationService } from "../../features/payment-integration-service/pagstar-payment-integration-service/pagstar-payment-integration-service";
import { _usersService, UsersService } from "../../features/users-service/users-service";
import { PaymentService } from "../../features/payment-service/payment-service";
import { SuitPayCreatePixPaymentResponseBody, SuitpayPaymentIntegrationService } from "../../features/payment-integration-service/suitpay-payment-integration-service/suitpay-payment-integration-service";

let _io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

interface ClientToServerEvents
{
    hello: () => void;
}

interface ServerToClientEvents
{
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;

    onPurchaseFinished: (animalPurchaseId: string) => void;
    [eventName: string]: (...args: any[]) => void;
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

export let SetupRoute = async (
    baseExpressApp: Express,
    ioServer: Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >) =>
{
    _io = ioServer;

    // get public store config
    baseExpressApp.get('/app-config/store-config', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];

        let isAuthenticated: boolean = false;
        // let animalsStoreItemList: Array<AnimalStoreItem> = [];

        let responseObject: StoreConfigDocument = {
            AnimalsStoreItemList: [],
            SlotStoreItemList: [],
        }

        if (authHeader)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                responseObject = await StoreService.GetPublicStoreConfig();
                response.status(200).send(responseObject);
            }
        }

        if (!isAuthenticated)
        {
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });

    baseExpressApp.patch('/animals', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        let animalPatchRequest = request.body as AnimalPatchRequest;

        let isAuthenticated: boolean = false;
        let isValidOperation: boolean = animalPatchRequest.Action == 'sell-animal';

        let responseObject: AnimalPatchResponse =
        {
            Success: false,
            Action: animalPatchRequest.Action,
            Errors: [],
        }

        if (authHeader && isValidOperation)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                let animalSellRequest = animalPatchRequest as AnimalSellRequest;

                let animalSellResult: AnimalSellResult = await IncomesService.RegisterAnimalSell(
                    userId,
                    animalSellRequest.AnimalId);

                responseObject.Success = animalSellResult.Success;
                responseObject.Errors = animalSellResult.Errors;

                if (responseObject.Success)
                    response.status(200).send(responseObject);
                else
                {
                    console.error(
                        '$$$ > ' +
                        'ERROR trying to RegisterAnimalSell!!!' + '\n' +
                        'userId = ',
                        userId, '\n',
                        'animalSellRequest.AnimalId = ',
                        animalSellRequest.AnimalId,
                        'animalSellResult = ',
                        animalSellResult, '\n',
                    );

                    // 403 == "Forbidden" ("animal-was-already-sold", "animal-not-in-inventory" or other error...)
                    response.status(403).send(responseObject);
                }
            }
        }

        if (!isAuthenticated || !isValidOperation)
        {
            console.log("$$$ > isAuthenticated OR isValidOperation is FALSE!");
            response.status(401).send(responseObject);
        }
    });


    baseExpressApp.post('/purchase', async (request: Request, response: Response) =>
    {
        const authHeader = request.headers['authorization'];
        const itemPurchaseRequest = request.body as ItemPurchaseRequest;

        let isAuthenticated: boolean = false;

        let responseObject = {}

        if (authHeader)
        {
            const userId = await GetUserIdByToken(authHeader);

            if (userId)
            {
                isAuthenticated = true;

                if (itemPurchaseRequest.ItemId)
                {
                    let privateUserProfile = await _usersService.GetPrivateUserProfileDocument(userId);

                    if (privateUserProfile)
                    {
                        let storeConfigDocument: StoreConfigDocument = await StoreService.GetPublicStoreConfig();

                        let baseStoreItem: any =
                            storeConfigDocument.AnimalsStoreItemList
                                .find(
                                    (item: AnimalStoreItem) => 
                                    {
                                        let hasMatch: boolean =
                                            item.Id == itemPurchaseRequest.ItemId &&
                                            item.IsVisible &&
                                            StoreService.WasAnimalItemReleased(item.ReleaseDateTime);

                                        return hasMatch;
                                    }
                                );

                        if (!baseStoreItem)
                        {
                            baseStoreItem =
                                storeConfigDocument.SlotStoreItemList
                                    .find(
                                        (item: SlotStoreItem) => 
                                        {
                                            let hasMatch: boolean =
                                                item.Id == itemPurchaseRequest.ItemId &&
                                                item.IsVisible &&
                                                StoreService.WasAnimalItemReleased(item.ReleaseDateTime);

                                            return hasMatch;
                                        }
                                    );
                        }

                        if (baseStoreItem && baseStoreItem.type)
                        {
                            switch (baseStoreItem.type as string)
                            {
                            case ('AnimalStoreItem'):
                                {
                                    let animalStoreItem = baseStoreItem as AnimalStoreItem;

                                    let userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(userId);
                                    let temporarySlots = await AnimalService.GetTemporarySlots(userId);
                                    userAnimalsDocument.SlotsList = userAnimalsDocument.SlotsList.concat(temporarySlots);

                                    let availableAnimalSlot: number = await AnimalService.GetFirstAvailableAnimalSlot(userId, userAnimalsDocument);

                                    if (availableAnimalSlot != -1)
                                    {
                                        let expirationInMinutes = 5;
                                        let utcNowInMs = _timeService.GetUtcNow().getTime();
                                        let expirationInMs = utcNowInMs + expirationInMinutes * 1000 * 60;
                                        let purchaseExpirationDate: Date = new Date(expirationInMs);
                                        let expirationDateUtc = purchaseExpirationDate.toISOString();

                                        let purchaseInternalId = uuidv4();

                                        await PaymentService.RegisterAnimalPurchaseRequest(
                                            purchaseInternalId,
                                            animalStoreItem.Id,
                                            userId,
                                            animalStoreItem);


                                        let createPixPaymentResponseBody: SuitPayCreatePixPaymentResponseBody =
                                            await SuitpayPaymentIntegrationService
                                                .CreatePixPayment(
                                                    animalStoreItem.Price,
                                                    privateUserProfile.FullName,
                                                    privateUserProfile.CPF,
                                                    privateUserProfile.Email,
                                                    purchaseInternalId,
                                                );
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // let createPixPaymentResponseBody: CreatePixPaymentResponseBody =
                                        //     await PagstarPaymentIntegrationService
                                        //         .FAKE_CreatePixPayment(
                                        //             baseStoreItem.Price,
                                        //             privateUserProfile.FullName,
                                        //             privateUserProfile.CPF,
                                        //             privateUserProfile.Email,
                                        //             purchaseInternalId,
                                        //         );
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!
                                        // ! DEBUG ONLY!!!!!!!!!!!

                                        if (createPixPaymentResponseBody == undefined)
                                        {
                                            // 500 == "Internal Server Error" (no private user profile was found)
                                            response.status(500).send({});
                                            return;
                                        }

                                        let responseObject: ItemPurchaseResponse =
                                        {
                                            Id: uuidv4(),
                                            ItemId: animalStoreItem.Id,
                                            Status: ItemPurchaseResponseStatus.Pending,

                                            // AnimalId: AnimalId,
                                            PurchaseInternalId: purchaseInternalId,
                                            ExpirationDate: expirationDateUtc,
                                            PaymentUrl: '',
                                            PaymentUrlKey: '',

                                            ErrorsList: [],
                                        };

                                        if (createPixPaymentResponseBody.data.response == 'OK')
                                        {
                                            responseObject.Status = ItemPurchaseResponseStatus.Pending;

                                            responseObject.PaymentUrl = createPixPaymentResponseBody.data.paymentCode;
                                            responseObject.PaymentUrlKey = createPixPaymentResponseBody.data.paymentCode;
                                        }
                                        else
                                        {
                                            responseObject.Status = ItemPurchaseResponseStatus.Error;
                                            responseObject.ErrorsList.push(createPixPaymentResponseBody.statusText);
                                        }

                                        response.status(200).send(responseObject);
                                    }
                                    else
                                    {
                                        responseObject = { Reason: 'User has no available animal slots', }
                                        // 403 == "Forbidden" (no available AnimalSlots)
                                        response.status(403).send(responseObject);
                                    }

                                    break;
                                }

                            case ('SlotStoreItem'):
                                {
                                    let slotStoreItem = baseStoreItem as SlotStoreItem;

                                    let userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(userId);

                                    let expirationInMinutes = 5;
                                    let utcNowInMs = _timeService.GetUtcNow().getTime();
                                    let expirationInMs = utcNowInMs + expirationInMinutes * 1000 * 60;
                                    let purchaseExpirationDate: Date = new Date(expirationInMs);
                                    let expirationDateUtc = purchaseExpirationDate.toISOString();

                                    let purchaseInternalId = uuidv4();

                                    await PaymentService.RegisterSlotPurchaseRequest(
                                        purchaseInternalId,
                                        slotStoreItem.Id,
                                        userId,
                                        slotStoreItem);


                                    let createPixPaymentResponseBody: SuitPayCreatePixPaymentResponseBody =
                                        await SuitpayPaymentIntegrationService
                                            .CreatePixPayment(
                                                baseStoreItem.Price,
                                                privateUserProfile.FullName,
                                                privateUserProfile.CPF,
                                                privateUserProfile.Email,
                                                purchaseInternalId,
                                            );

                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // let createPixPaymentResponseBody: CreatePixPaymentResponseBody =
                                    //     await PagstarPaymentIntegrationService
                                    //         .FAKE_CreatePixPayment(
                                    //             baseStoreItem.Price,
                                    //             privateUserProfile.FullName,
                                    //             privateUserProfile.CPF,
                                    //             privateUserProfile.Email,
                                    //             purchaseInternalId,
                                    //         );
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!
                                    // ! DEBUG ONLY!!!!!!!!!!!

                                    if (createPixPaymentResponseBody == undefined)
                                    {
                                        // 500 == "Internal Server Error" (no private user profile was found)
                                        response.status(500).send({});
                                        return;
                                    }

                                    let responseObject: ItemPurchaseResponse =
                                    {
                                        Id: uuidv4(),
                                        ItemId: slotStoreItem.Id,
                                        Status: ItemPurchaseResponseStatus.Pending,

                                        // AnimalId: AnimalId,
                                        PurchaseInternalId: purchaseInternalId,
                                        ExpirationDate: expirationDateUtc,
                                        PaymentUrl: '',
                                        PaymentUrlKey: '',

                                        ErrorsList: [],
                                    };

                                    if (createPixPaymentResponseBody.data.response == 'OK')
                                    {
                                        responseObject.Status = ItemPurchaseResponseStatus.Pending;

                                        responseObject.PaymentUrl = createPixPaymentResponseBody.data.paymentCode;
                                        responseObject.PaymentUrlKey = createPixPaymentResponseBody.data.paymentCode;
                                    }
                                    else
                                    {
                                        responseObject.Status = ItemPurchaseResponseStatus.Error;
                                        responseObject.ErrorsList.push(createPixPaymentResponseBody.statusText);
                                    }

                                    response.status(200).send(responseObject);

                                    break;
                                }
                            }


                        }
                        else
                        {
                            // 404 == "Not found" (no related item was found)
                            response.status(404).send(responseObject);
                        }
                    }
                    else
                    {
                        // 500 == "Internal Server Error" (no private user profile was found)
                        response.status(500).send(responseObject);
                    }
                }
                else
                {
                    // 400 == "Bad Request" (no animal id)
                    response.status(400).send(responseObject);
                }
            }
        }

        if (!isAuthenticated)
        {
            // 401 == "Unauthorized" (not autheticated)
            console.log("$$$ > isAuthenticated is FALSE!");
            response.status(401).send(responseObject);
        }
    });
}

export let SendPurchaseValidationWarnAsync = async (animalPurchaseId: string) =>
{
    await Delay(1);

    _io.in(animalPurchaseId).emit('on-purchase-validation-started', animalPurchaseId)
}

export let SendPurchaseConfimationAsync = async (animalPurchaseId: string) =>
{
    await Delay(1);

    _io.in(animalPurchaseId).emit('on-purchase-finished', animalPurchaseId)
}














export interface ItemPurchaseRequest
{
    ItemId: string,
}

export interface ItemPurchaseResponse
{
    Id: string;
    ItemId: string;
    Status: ItemPurchaseResponseStatus,

    PurchaseInternalId: string,
    ExpirationDate: string,
    PaymentUrl: string,
    PaymentUrlKey: string,

    ErrorsList: string[],
}

export enum ItemPurchaseResponseStatus
{
    UNDEFINED = -1,

    FakeTemporary,
    Pending,
    Finished,
    Error,
}

export interface AnimalPatchRequest 
{
    Action: string,
}

export interface AnimalSellRequest extends AnimalPatchRequest 
{
    AnimalId: string,
}

export interface AnimalPatchResponse 
{
    Success: boolean,
    Action: string,
    Errors: string[],
}
