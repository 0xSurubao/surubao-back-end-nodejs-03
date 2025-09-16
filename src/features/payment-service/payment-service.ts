// base
import http from "node:http";
import { v4 as uuidv4 } from 'uuid';

// from project
import { UserRegisterRequest } from "../auth-service/auth-service";
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { _pushNotificationService, PushNotificationToken, PushNotificationEntry, PushNotificationServce as PushNotificationService } from '../push-notification-service/push-notification-service';
import { _timeService, TimeService } from '../time-service/time-service';
import { _usersService, PublicUserProfileDocument } from "../users-service/users-service";
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey } from "../utils/project-utils";
import { AnimalService } from "../animals-service/animals-service";
import { SendPurchaseConfimationAsync, SendPurchaseValidationWarnAsync } from "../../api/store/store-route";
import { AnimalStoreItem, SlotStoreItem, WithdrawParameters } from "../store-service/store-service";
import { WithdrawService } from "../withdraw-service/withdraw-service";
import { EnvironmentHandler } from "../environment-handler/environment-handler";


export class PaymentService
{

    static GetPurchaseRegisterDocument = async () =>
    {
        let document: PurchaseRegisterDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'dashboard-private',
                'purchase-register-private',
            ) as PurchaseRegisterDocument;

        // console.log(
        //     '### GetPurchaseRegisterDocument | document = ' + '\n',
        //     document,
        // );

        if (!document)
        {
            document =
            {
                PurchaseRegisterListByBrazilianDate: {},
            }
        }

        return document;
    }

    static SetPurchaseRegisterDocument = async (document: PurchaseRegisterDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'dashboard-private',
            'purchase-register-private',
            document,
        );
    }

    static RegisterAnimalPurchaseRequest = async (
        purchaseInternalId: string,
        animalItemId: string,
        ownerId: string,
        animalStoreItem: AnimalStoreItem,
    ) =>
    {
        let utcNow = _timeService.GetUtcNow();
        let todayBrazilianKey = ConvertUtcDateToBrazilianDayKey(utcNow);

        let registerDocument: PurchaseRegisterDocument = await PaymentService.GetPurchaseRegisterDocument();

        let listsByDate: { [key: string]: DayPurchaseRegister } = registerDocument.PurchaseRegisterListByBrazilianDate;
        let todayRegisters: DayPurchaseRegister = { PurchaseRegisterById: {} };

        // console.log(
        //     '### purchaseListsByDate = ' + '\n',
        //     purchaseListsByDate,
        // );

        if (todayBrazilianKey in listsByDate)
            todayRegisters = listsByDate[todayBrazilianKey];
        else
            listsByDate[todayBrazilianKey] = todayRegisters;

        let newPurchaseRegister: PurchaseRegister =
        {
            PurchaseInternalId: purchaseInternalId,
            CreatedAtDate: utcNow.toISOString(),

            BaseItemId: animalItemId,
            WasFinished: false,

            OwnerId: ownerId,
            Type: PurchaseRegisterType.Animal,
            StoreItem: animalStoreItem,
        }

        todayRegisters.PurchaseRegisterById[purchaseInternalId] = (newPurchaseRegister);

        await PaymentService.SetPurchaseRegisterDocument(registerDocument);
    }

    static RegisterSlotPurchaseRequest = async (
        purchaseInternalId: string,
        animalItemId: string,
        ownerId: string,
        slotStoreItem: SlotStoreItem,
    ) =>
    {
        let utcNow = _timeService.GetUtcNow();
        let todayBrazilianKey = ConvertUtcDateToBrazilianDayKey(utcNow);

        let purchaseRegister: PurchaseRegisterDocument = await PaymentService.GetPurchaseRegisterDocument();

        let purchaseListsByDate: { [key: string]: DayPurchaseRegister } = purchaseRegister.PurchaseRegisterListByBrazilianDate;
        let todayPurchases: DayPurchaseRegister = { PurchaseRegisterById: {} };

        // console.log(
        //     '### purchaseListsByDate = ' + '\n',
        //     purchaseListsByDate,
        // );

        if (todayBrazilianKey in purchaseListsByDate)
            todayPurchases = purchaseListsByDate[todayBrazilianKey];
        else
            purchaseListsByDate[todayBrazilianKey] = todayPurchases;

        let newPurchaseRegister: PurchaseRegister =
        {
            PurchaseInternalId: purchaseInternalId,
            CreatedAtDate: utcNow.toISOString(),

            BaseItemId: animalItemId,
            WasFinished: false,

            OwnerId: ownerId,
            Type: PurchaseRegisterType.Slot,
            StoreItem: slotStoreItem,
        }

        todayPurchases.PurchaseRegisterById[purchaseInternalId] = (newPurchaseRegister);

        await PaymentService.SetPurchaseRegisterDocument(purchaseRegister);
    }

    static RegisterWithdrawPurchaseRequest = async (
        purchaseInternalId: string,
        ownerId: string,
        withdrawParameters: WithdrawParameters,
    ) =>
    {
        let utcNow = _timeService.GetUtcNow();
        let todayBrazilianKey = ConvertUtcDateToBrazilianDayKey(utcNow);

        let purchaseRegister: PurchaseRegisterDocument = await PaymentService.GetPurchaseRegisterDocument();

        let listsByDate: { [key: string]: DayPurchaseRegister } = purchaseRegister.PurchaseRegisterListByBrazilianDate;
        let todayRegisters: DayPurchaseRegister = { PurchaseRegisterById: {} };

        // console.log(
        //     '### purchaseListsByDate = ' + '\n',
        //     purchaseListsByDate,
        // );

        if (todayBrazilianKey in listsByDate)
            todayRegisters = listsByDate[todayBrazilianKey];
        else
            listsByDate[todayBrazilianKey] = todayRegisters;

        let newRegister: PurchaseRegister =
        {
            PurchaseInternalId: purchaseInternalId,
            CreatedAtDate: utcNow.toISOString(),

            BaseItemId: 'n/a',
            WasFinished: false,

            OwnerId: ownerId,
            Type: PurchaseRegisterType.Withdraw,
            StoreItem: withdrawParameters,
        }

        todayRegisters.PurchaseRegisterById[purchaseInternalId] = (newRegister);

        await PaymentService.SetPurchaseRegisterDocument(purchaseRegister);
    }

    static FinishItemPurchaseRequest = async (
        purchaseInternalId: string,
        externalTransactionId: string,
    ) =>
    {
        SendPurchaseValidationWarnAsync(purchaseInternalId);

        let success = false;

        let utcNow = _timeService.GetUtcNow();
        let timeGapInMinutes = 10;

        let allPossibleDateKeys = new Set<string>();

        // will get all date keys of:
        // | now - 10mins
        // | now 
        // | now + 10mins
        for (let index = -1; index < 2; index++)
        {
            let timeGapInMs = timeGapInMinutes * 60 & 1000 * index;
            let timeGameDate = new Date(utcNow.getTime() + timeGapInMs);
            let todayBrazilianKey = ConvertUtcDateToBrazilianDayKey(timeGameDate);

            allPossibleDateKeys.add(todayBrazilianKey);
        }

        let purchaseRegisterDocument: PurchaseRegisterDocument = await PaymentService.GetPurchaseRegisterDocument();
        // let purchaseRegister: any = undefined;

        let hasFoundPurchaseRegister = false;

        // allPossibleDateKeys.

        let possibleKeys: string[] = Array.from(allPossibleDateKeys.values());



        await Promise.all(possibleKeys.map(
            async (possibleDateKey: string) =>
            {
                if (hasFoundPurchaseRegister)
                    return;

                if (possibleDateKey in purchaseRegisterDocument.PurchaseRegisterListByBrazilianDate)
                {
                    let dayPurchaseRegister = purchaseRegisterDocument.PurchaseRegisterListByBrazilianDate[possibleDateKey];

                    if (purchaseInternalId in dayPurchaseRegister.PurchaseRegisterById)
                    {
                        hasFoundPurchaseRegister = true;

                        let register: PurchaseRegister = dayPurchaseRegister.PurchaseRegisterById[purchaseInternalId];

                        if (!register.WasFinished)
                        {
                            register.WasFinished = true;

                            switch (register.Type)
                            {
                            case PurchaseRegisterType.Animal:
                                await AnimalService.RegisterAnimalBuy(register.OwnerId, register.StoreItem as AnimalStoreItem);
                                success = true;
                                break;

                            case PurchaseRegisterType.Slot:
                                await AnimalService.RegisterSlotBuy(register.OwnerId, register.StoreItem as SlotStoreItem);
                                success = true;
                                break;

                            case PurchaseRegisterType.Withdraw:
                                {
                                    let withdrawParameters = register.StoreItem as WithdrawParameters;

                                    await WithdrawService.RegisterWithdrawRequest(
                                        register.OwnerId,
                                        withdrawParameters,
                                        true,
                                        purchaseInternalId,
                                        externalTransactionId,
                                    );

                                    success = true;
                                    break;
                                }
                            }

                            // if ( == PurchaseRegisterType.Animal)
                            // {

                            // }

                            if (success)
                                await PaymentService.SetPurchaseRegisterDocument(purchaseRegisterDocument);

                            success = true;
                            SendPurchaseConfimationAsync(register.PurchaseInternalId);
                        }
                    }
                }
            }));

        // console.log(
        //     '## FinishAnimalPurchaseRequest | purchaseInternalId = ',
        //     purchaseInternalId,
        // );

        // console.log(
        //     '## FinishAnimalPurchaseRequest | allPossibleDateKeys = ',
        //     allPossibleDateKeys,
        // );

        // console.log(
        //     '## FinishAnimalPurchaseRequest | purchaseRegister = ',
        //     purchaseRegister,
        // );

        // if (purchaseRegister)
        // {
        //     let register = purchaseRegister as PurchaseRegister;

        //     if (!register.WasFinished)
        //     {
        //         register.WasFinished = true;
        //         await AnimalService.RegisterAnimalBuy(register.OwnerId, register.AnimalStoreItem);
        //         SendPurchaseConfimationAsync(register.PurchaseInternalId);
        //         await PaymentService.SetPurchaseRegisterDocument(purchaseRegisterDocument);

        //         success = true;
        //     }
        // }

        return success;
    }
}

export interface PurchaseRegisterDocument
{
    PurchaseRegisterListByBrazilianDate: { [key: string]: DayPurchaseRegister }
}

export interface DayPurchaseRegister
{
    PurchaseRegisterById: { [key: string]: PurchaseRegister }
}

export interface PurchaseRegister
{
    PurchaseInternalId: string,
    CreatedAtDate: string,

    OwnerId: string,
    WasFinished: boolean,

    Type: PurchaseRegisterType,

    BaseItemId: string,
    StoreItem: AnimalStoreItem | SlotStoreItem | WithdrawParameters,
}

export enum PurchaseRegisterType
{
    Animal,
    Slot,
    Withdraw,
}
