// base
import { v4 as uuidv4 } from 'uuid';

// from project
import { _ativitiesService } from "../activities-service/activities-service";
import { AnimalStoreItem, SlotStoreItem, StoreConfigDocument, StoreService } from './../store-service/store-service';
import { _incomesService } from '../incomes-service/incomes-service';
import { GetDocData, GetDocRef, SetDocData } from '../firebase-admin/firebase-admin';
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey, GetRandomInt } from '../utils/project-utils';
import { _usersService, PublicUserProfileDocument } from '../users-service/users-service';
import { _affiliatesClubService, AffiliatesClubDocument, AffiliatesClubService } from '../affiliates-service/affiliates-club-service';
import { _mailService, MailData, MailService, MailType } from '../mail-service/mail-service';
import { _pushNotificationService, PushNotificationServce } from '../push-notification-service/push-notification-service';
import { _timeService } from '../time-service/time-service';
import { Transaction } from 'firebase-admin/firestore';
import { EnvironmentHandler } from '../environment-handler/environment-handler';


export class AnimalService
{
    static GetPublicAnimalsDocRef = async (ownerId: string,
    ) =>
    {
        let docRef = GetDocRef(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-animals-public',
            ownerId,
        );

        return docRef;
    }


    static GetPublicAnimalsDocument = async (
        ownerId: string,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        let document: AnimalsDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-animals-public',
                ownerId,
                baseTransaction,
            ) as AnimalsDocument;

        if (!document)
        {
            let slotId = uuidv4();
            let utcNow = _timeService.GetUtcNow();

            let initialAnimalSlot: AnimalSlot =
            {
                Id: slotId,
                Index: 0,
                Price: 0,
                IsTemporary: false,
                CreatedAtDate: utcNow.toISOString(),
            }

            document =
            {
                OwnerId: ownerId,
                AnimalsList: [],
                SlotsList: [initialAnimalSlot],
            }
        }

        return document;
    }

    static SetPublicAnimalsDocument = async (
        ownerId: string,
        document: AnimalsDocument,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        document.SlotsList = document.SlotsList.filter(item => item.IsTemporary == undefined || item.IsTemporary == false);

        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-animals-public',
            ownerId,
            document,
            baseTransaction,
        );
    }

    static GetTemporarySlots = async (
        userId: string | undefined = undefined,
        userOwnClubCode: string | undefined = undefined,
        affiliatesClubDocument: AffiliatesClubDocument | undefined = undefined,
    ) =>
    {
        let temporarySlots: Array<AnimalSlot> = [];

        let temporarySlotsAmount = await _affiliatesClubService.GetUserLevel(userId, userOwnClubCode, affiliatesClubDocument);

        console.log('temporarySlotsAmount = ', temporarySlotsAmount);

        for (let index = 0; index < temporarySlotsAmount; index++)
        {
            let temporarySlot: AnimalSlot =
            {
                Id: '01234',
                Index: index,
                Price: 0,
                IsTemporary: true,
                CreatedAtDate: _timeService.GetUtcNow().toISOString(),
            }

            temporarySlots.push(temporarySlot);
        }

        return temporarySlots;
    }

    /**
     * Returns `-1` if has NO available AnimalSlot
     */
    static GetFirstAvailableAnimalSlot = async (ownerId: string, userAnimalsDocument: AnimalsDocument | undefined = undefined) =>
    {
        let availableAnimalSlot: number = -1;

        if (!userAnimalsDocument)
            userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(ownerId);

        let slotsIndexesOfOwner = userAnimalsDocument.SlotsList.map(slot => slot.Index);
        const usedIndexes: Set<number> = new Set();

        for (const animal of userAnimalsDocument.AnimalsList)
        {
            if (!animal.WasSold)
                usedIndexes.add(animal.SlotIndex);
        }

        const availableAnimalSlots = slotsIndexesOfOwner.filter(index => !usedIndexes.has(index));

        if (availableAnimalSlots.length > 0)
            availableAnimalSlot = availableAnimalSlots[0];

        return availableAnimalSlot;
    }

    static RegisterAnimalBuy = async (
        userId: string,
        animalStoreItem: AnimalStoreItem,
        userAnimalsDocument: AnimalsDocument | undefined = undefined,
        publicUserProfileDocument: PublicUserProfileDocument | undefined = undefined) =>
    {
        let newAnimalId: string = uuidv4();
        let animalDurationInDays: number = animalStoreItem.DurationInDays;

        let utcNow = _timeService.GetUtcNow();
        let dayEndOffset: number = (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
        let dayStartDate: Date = ConvertUtcDateToBrazilianDayDateStart(utcNow);
        let dayEndDate: Date = new Date(dayStartDate.getTime() + dayEndOffset);
        let brazilianDateDayKey: string = ConvertUtcDateToBrazilianDayKey(utcNow);
        // let animalDurationDeadLineInMs = dayEndDate.getTime() + animalStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
        let animalDurationDeadLineInMs = utcNow.getTime() + animalStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
        let animalDurationDeadLine = new Date(animalDurationDeadLineInMs);

        if (userAnimalsDocument = undefined)
            userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(userId);

        let temporarySlots = await AnimalService.GetTemporarySlots(userId);

        if (userAnimalsDocument)
            userAnimalsDocument.SlotsList = userAnimalsDocument.SlotsList.concat(temporarySlots);

        let availableAnimalSlot: number = await AnimalService.GetFirstAvailableAnimalSlot(userId, userAnimalsDocument);

        if (availableAnimalSlot != -1)
        {
            if (!userAnimalsDocument)
                userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(userId);

            await _ativitiesService.RegisterAnimalActivities(
                userId,
                newAnimalId,
                animalDurationInDays);

            let newAnimal: Animal =
            {
                Id: newAnimalId,

                Type: animalStoreItem.Type,
                SlotIndex: availableAnimalSlot,

                CreatedAtDate: utcNow.toISOString(),

                Price: animalStoreItem.Price,
                WasSold: false,

                PriceMultiplier: animalStoreItem.PriceMultiplier,
                DurationInDays: animalStoreItem.DurationInDays,
                DurationDeadLine: animalDurationDeadLine.toISOString(),
            }

            userAnimalsDocument.AnimalsList.push(newAnimal);

            if (!publicUserProfileDocument)
                publicUserProfileDocument = await _usersService.GetPublicUserProfileDocument(userId);

            await _incomesService.AddAnimalInicialIncome(userId, newAnimal);
            await AnimalService.SetPublicAnimalsDocument(userId, userAnimalsDocument);
            await AnimalService.RegisterAnimalClubEffects(newAnimal, userAnimalsDocument, publicUserProfileDocument!)
        }
        else
        {
            // responseObject = { Reason: 'User has no available animal slots', }
            // 403 == "Forbidden" (no available AnimalSlots)
            // response.status(403).send(responseObject);

            console.error(
                '$$$ > ' +
                'ERROR trying to RegisterAnimalBuy!!' + '\n' +
                'User has no available animal slots!', '\n',
                'ownerId = ', userId, '\n',
                'animalStoreItem = ', animalStoreItem, '\n',
            )
        }
    }

    static AddAnimalByAdmin = async (
        userId: string,
        animalType: string,
        adminId: string,
        ignoreSlotsLimitation: boolean,
        ignoreComissions: boolean,
        publicUserProfileDocument: PublicUserProfileDocument | undefined = undefined,
    ) =>
    {
        let storeConfigDocument: StoreConfigDocument = await StoreService.GetPublicStoreConfig();
        let baseStoreItem: any =
            storeConfigDocument.AnimalsStoreItemList
                .find(
                    (item: AnimalStoreItem) => 
                    {
                        let hasMatch: boolean =
                            item.Type == animalType &&
                            item.IsVisible &&
                            StoreService.WasAnimalItemReleased(item.ReleaseDateTime);

                        return hasMatch;
                    }
                );

        if (baseStoreItem)
        {
            let animalStoreItem = baseStoreItem as AnimalStoreItem;
            let userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(userId);

            let newAnimalId: string = uuidv4();
            let animalDurationInDays: number = animalStoreItem.DurationInDays;

            let utcNow = _timeService.GetUtcNow();
            let dayEndOffset: number = (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
            let dayStartDate: Date = ConvertUtcDateToBrazilianDayDateStart(utcNow);
            let dayEndDate: Date = new Date(dayStartDate.getTime() + dayEndOffset);
            let brazilianDateDayKey: string = ConvertUtcDateToBrazilianDayKey(utcNow);
            // let animalDurationDeadLineInMs = dayEndDate.getTime() + animalStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
            let animalDurationDeadLineInMs = utcNow.getTime() + animalStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
            let animalDurationDeadLine = new Date(animalDurationDeadLineInMs);

            let availableAnimalSlot: number = await AnimalService.GetFirstAvailableAnimalSlot(userId, userAnimalsDocument);
            if (availableAnimalSlot == -1)
            {
                if (ignoreSlotsLimitation)
                {
                    let maxSlotIndex = 0;

                    let slotsIndexesOfOwner = userAnimalsDocument.SlotsList.map(slot => slot.Index);

                    for (const slotIndex of slotsIndexesOfOwner)
                    {
                        if (slotIndex > maxSlotIndex)
                            maxSlotIndex = slotIndex;
                    }

                    availableAnimalSlot = maxSlotIndex + 1;

                    let hasFoundAvailableSlot = false;

                    while (!hasFoundAvailableSlot)
                    {
                        let animalOnSlot =
                            userAnimalsDocument.AnimalsList
                                .find((animal) => !animal.WasSold && animal.SlotIndex == availableAnimalSlot);

                        if (animalOnSlot)
                            availableAnimalSlot++;
                        else
                            hasFoundAvailableSlot = true;
                    }
                }
                else
                    throw new Error('User has no empty slot!')
            }

            await _ativitiesService.RegisterAnimalActivities(
                userId,
                newAnimalId,
                animalDurationInDays);

            let newAnimal: Animal =
            {
                Id: newAnimalId,
                SourcesId: [adminId],

                Type: animalStoreItem.Type,
                SlotIndex: availableAnimalSlot,

                CreatedAtDate: utcNow.toISOString(),

                Price: animalStoreItem.Price,
                WasSold: false,

                PriceMultiplier: animalStoreItem.PriceMultiplier,
                DurationInDays: animalStoreItem.DurationInDays,
                DurationDeadLine: animalDurationDeadLine.toISOString(),
            }

            userAnimalsDocument.AnimalsList.push(newAnimal);

            await _incomesService.AddAnimalInicialIncome(userId, newAnimal);
            await AnimalService.SetPublicAnimalsDocument(userId, userAnimalsDocument);

            if (!ignoreComissions)
            {
                if (!publicUserProfileDocument)
                    publicUserProfileDocument = await _usersService.GetPublicUserProfileDocument(userId);

                await AnimalService.RegisterAnimalClubEffects(newAnimal, userAnimalsDocument, publicUserProfileDocument!)
            }
        }
        else
            throw new Error('Animal item was not found!');
    }

    static RegisterSlotBuy = async (
        ownerId: string,
        slotStoreItem: SlotStoreItem,
        userAnimalsDocument: AnimalsDocument | undefined = undefined,
        publicUserProfileDocument: PublicUserProfileDocument | undefined = undefined) =>
    {
        // let animalDurationInDays: number = slotStoreItem.DurationInDays;

        let utcNow = _timeService.GetUtcNow();
        // let dayEndOffset: number = (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
        // let dayStartDate: Date = ConvertUtcDateToBrazilianDayDateStart(utcNow);
        // let dayEndDate: Date = new Date(dayStartDate.getTime() + dayEndOffset);
        // let brazilianDateDayKey: string = ConvertUtcDateToBrazilianDayKey(utcNow);
        // // let animalDurationDeadLineInMs = dayEndDate.getTime() + animalStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
        // let animalDurationDeadLineInMs = utcNow.getTime() + slotStoreItem.DurationInDays * 24 * 60 * 60 * 1000;
        // let animalDurationDeadLine = new Date(animalDurationDeadLineInMs);

        if (!userAnimalsDocument)
            userAnimalsDocument = await AnimalService.GetPublicAnimalsDocument(ownerId);

        let newSlotId: string = uuidv4();

        let newSlot: AnimalSlot =
        {
            Id: newSlotId,

            Index: slotStoreItem.Index,
            Price: slotStoreItem.Price,
            IsTemporary: false,

            CreatedAtDate: utcNow.toISOString(),
        }

        userAnimalsDocument.SlotsList.push(newSlot);


        // ! add slot twice
        // !!!! DEBUG ONLY!!!!!!!!!!!
        // !!!! DEBUG ONLY!!!!!!!!!!!
        // !!!! DEBUG ONLY!!!!!!!!!!!
        // userAnimalsDocument.SlotsList.push(
        //     {
        //         Id: uuidv4(),

        //         Index: slotStoreItem.Index,
        //         Price: slotStoreItem.Price,
        //         IsTemporary: false,

        //         CreatedAtDate: utcNow.toISOString(),
        //     });
        // !!!! DEBUG ONLY!!!!!!!!!!!
        // !!!! DEBUG ONLY!!!!!!!!!!!
        // !!!! DEBUG ONLY!!!!!!!!!!!

        if (!publicUserProfileDocument)
            publicUserProfileDocument = await _usersService.GetPublicUserProfileDocument(ownerId);

        await AnimalService.SetPublicAnimalsDocument(ownerId, userAnimalsDocument);
    }

    static RegisterAnimalClubEffects = async (
        newAnimal: Animal,
        buyerAnimals: AnimalsDocument,
        buyerPublicProfile: PublicUserProfileDocument) =>
    {
        if (!buyerPublicProfile.HasNoIndicationCode)
        {
            let clubCode = buyerPublicProfile.IndicationCode;
            let affiliatesClub = await _affiliatesClubService.GetClubDocument(clubCode);

            if (affiliatesClub)
            {
                // TODO: MOVE THIS TO A CONFIG FILE!
                let firstAnimalBonusValue: number = 20;
                let consecutiveAnimalsComissionFactor: number = 0.1;
                let utcNow = _timeService.GetUtcNow();


                let buyerMember = affiliatesClub.MembersById[buyerPublicProfile.Id];

                if (buyerMember)
                {
                    buyerMember.LastActivityDate = utcNow.toISOString();
                    buyerMember.LastClubActivityDate = utcNow.toISOString();

                    affiliatesClub.MembersById[buyerPublicProfile.Id] = buyerMember;
                    await _affiliatesClubService.SetClubDocument(clubCode, affiliatesClub);
                }


                let isFirstAnimalBuy = buyerAnimals?.AnimalsList.length == 1;

                let mailData: MailData =
                    AnimalService.GetClubEffectMail(
                        isFirstAnimalBuy,
                        firstAnimalBonusValue,
                        consecutiveAnimalsComissionFactor,
                        newAnimal,
                        buyerPublicProfile,
                        affiliatesClub);

                await _incomesService.HandleClubCommission(
                    isFirstAnimalBuy,
                    firstAnimalBonusValue,
                    consecutiveAnimalsComissionFactor,
                    buyerMember,
                    newAnimal,
                    buyerPublicProfile,
                    affiliatesClub);

                await MailService.TryToAddMail(affiliatesClub.OwnerId, mailData!);
                await AnimalService.SendMailAsNotification(mailData!, affiliatesClub);
                await _affiliatesClubService.SetClubDocument(clubCode, affiliatesClub);
            }
        }
    }

    static GetClubEffectMail = (
        isFirstAnimalBuy: boolean,
        firstAnimalBonusValue: number,
        consecutiveAnimalsComissionFactor: number,
        newAnimal: Animal,
        buyerPublicProfile: PublicUserProfileDocument,
        affiliatesClub: AffiliatesClubDocument): MailData =>
    {
        let value: MailData | null = null;

        if (isFirstAnimalBuy)
        {
            // 1st animal bonus
            value =
                AnimalService.GetClubIndicationMail(
                    affiliatesClub.OwnerId,
                    buyerPublicProfile.Username,
                    firstAnimalBonusValue);
        }
        else
        {
            // comission
            value =
                AnimalService.GetClubComissionMail(
                    affiliatesClub.OwnerId,
                    buyerPublicProfile.Username,
                    newAnimal.Price * consecutiveAnimalsComissionFactor,
                    consecutiveAnimalsComissionFactor);
        }

        return value!;
    }

    static GetClubIndicationMail = (
        ownerId: string,
        indicatedUsername: string,
        bonusValue: number): MailData =>
    {
        let title = 'Você indicou e ganhou R$' + bonusValue.toFixed(2);
        let description: string[] =
            [
                'Parabéns! Agora o jogador ',
                '@' + indicatedUsername,
                ' faz parte do seu clube de fazendeiros, e por ele ter adquirido o primeiro animal você ganhou R$' + bonusValue + '.'
            ]

        let mailType: MailType = MailType.Bonus;
        let utcNow = _timeService.GetUtcNow();

        let value: MailData =
        {
            Id: uuidv4(),
            OwnerId: ownerId,

            Title: title,
            // even index == normal text
            // odd index == bold text
            Description: description,

            Type: mailType,
            CreationDateTime: utcNow.toISOString(),

            WasRead: false,
        }

        return value;
    }

    static GetClubComissionMail = (
        ownerId: string,
        indicatedUsername: string,
        commissionValue: number,
        commissionFactor: number): MailData =>
    {
        let title = 'Você recebeu comissão R$' + commissionValue.toFixed(2);
        let description: string[] =
            [
                'Parabéns! O membro do seu clube ',
                '@' + indicatedUsername,
                ' adquiriu um novo animal e você recebeu ' + (100 * commissionFactor) + '% de comissão!'
            ]

        let mailType: MailType = MailType.Commission;
        let utcNow = _timeService.GetUtcNow();

        let value: MailData =
        {
            Id: uuidv4(),
            OwnerId: ownerId,

            Title: title,
            // even index == normal text
            // odd index == bold text
            Description: description,

            Type: mailType,
            CreationDateTime: utcNow.toISOString(),

            WasRead: false,
        }

        return value;
    }

    static SendMailAsNotification = async (baseMailData: MailData, baseAffiliatesClub: AffiliatesClubDocument) =>
    {
        let notificationsTokens: string[] = [];
        let notificationTitle = AnimalService.GetMailTypeText(baseMailData.Type) + ' | ' + baseMailData.Title;
        let notificationContent = baseMailData.Description.join('');

        // console.log("### baseMailData.Description = ");
        // console.log(baseMailData.Description);
        // console.log("### notificationContent = ");
        // console.log('"' + notificationContent + '"');

        if (!baseAffiliatesClub.PushNotificationTokensByToken)
            baseAffiliatesClub.PushNotificationTokensByToken = {};

        let clubTokens = baseAffiliatesClub.PushNotificationTokensByToken;

        Object.keys(clubTokens).forEach(
            (key) =>
            {
                let token = clubTokens[key];

                if (token)
                    notificationsTokens.push(token.ClientToken);
            })

        await _pushNotificationService.SendNotifcation(notificationsTokens, notificationTitle, notificationContent);
    }

    static GetMailTypeText = (mailType: MailType) =>
    {
        let value = '';

        switch (mailType)
        {
        case MailType.Bonus:
            value = "Bônus"
            break;

        case MailType.Commission:
            value = "Comissão"
            break;

        case MailType.Warning:
            value = "Aviso"
            break;

        default:
            {
                console.error(
                    '$> ' +
                    'ERROR trying to GetMailTypeText!' + '\n' +
                    'UNEXPECTED mailType!' + '\n' +
                    'mailType = ' + mailType.toString() + '\n' +
                    '');

                value = mailType.toString();
                break;
            }
        }

        return value;
    }
}

export let _animalService: AnimalService = new AnimalService();


export interface AnimalsDocument
{
    OwnerId: string,
    AnimalsList: Array<Animal>,
    SlotsList: Array<AnimalSlot>,
}

export interface Animal
{
    Id: string;
    SourcesId?: string[],

    Type: string;
    SlotIndex: number;

    CreatedAtDate: string,

    Price: number;
    WasSold: boolean;

    PriceMultiplier: number;
    DurationInDays: number;
    DurationDeadLine: string;
}

export interface AnimalSlot
{
    Id: string,
    CreatedAtDate: string,
    Price: number,
    IsTemporary: boolean,

    Index: number,
}
