// base
import { v4 as uuidv4 } from 'uuid';

// from project
import { Animal, AnimalService, AnimalsDocument, _animalService } from '../animals-service/animals-service';
import { GetDocData, GetDocRef, SetDocData } from "../firebase-admin/firebase-admin";
import { AnimalStoreItem, StoreConfigDocument } from '../store-service/store-service';
import { _affiliatesClubService, AffiliatesClubDocument, AffiliatesClubMember } from '../affiliates-service/affiliates-club-service';
import { PublicUserProfileDocument } from '../users-service/users-service';
import { DocumentData, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { EnvironmentHandler } from '../environment-handler/environment-handler';
import { AppConfigService } from '../app-config-service/app-config-service';

export class IncomesService
{
    static GetPublicIncomesDocRef = (ownerId: string) =>
    {
        let docRef = GetDocRef(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-incomes-public',
            ownerId,
        )

        return docRef;
    }

    static GetPublicIncomesDocument = async (
        ownerId: string,
        baseTransaction: Transaction | undefined = undefined,
        docRef: DocumentReference<DocumentData, DocumentData> | undefined = undefined,) =>
    {
        let document: IncomesDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-incomes-public',
                ownerId,
                baseTransaction,
                docRef,
            ) as IncomesDocument;

        if (!document)
        {
            document =
            {
                OwnerId: ownerId,
                IncomesList: [],
            }
        }

        return document;
    }

    static SetPublicIncomesDocument = async (
        ownerId: string,
        activitiesDocument: IncomesDocument,
        baseTransaction: Transaction | undefined = undefined,
        docRef: DocumentReference<DocumentData, DocumentData> | undefined = undefined,
    ) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-incomes-public',
            ownerId,
            activitiesDocument,
            baseTransaction,
            docRef,
        );
    }

    AddAnimalInicialIncome = async (
        ownerId: string,
        baseAnimal: Animal,
        userIncomesDocument: IncomesDocument | undefined = undefined) =>
    {
        if (!userIncomesDocument)
            userIncomesDocument = await IncomesService.GetPublicIncomesDocument(ownerId);

        let animalIncomeByDay =
            baseAnimal.Price *
            baseAnimal.PriceMultiplier *
            (1 / baseAnimal.DurationInDays);

        let initialAnimalIncome: Income =
        {
            Id: uuidv4(),

            Value: animalIncomeByDay,
            Type: IcomeType.AnimalIcome,

            WasRedeemed: false,

            SourcesIds: [baseAnimal.Id],
        }

        userIncomesDocument.IncomesList.push(initialAnimalIncome);

        await IncomesService.SetPublicIncomesDocument(ownerId, userIncomesDocument);
    }

    static AddActivitiesIncomes = async (
        ownerId: string,
        activitiesIncomeEntry: ActivitiesIncomeEntry[],
        userIncomesDocument: IncomesDocument | undefined = undefined,
        userAnimals: AnimalsDocument | undefined = undefined,
        baseTransaction: Transaction | undefined = undefined,
        userIncomesDocRef: DocumentReference<DocumentData, DocumentData> | undefined = undefined,
    ) =>
    {
        if (!userIncomesDocument)
            userIncomesDocument = await IncomesService.GetPublicIncomesDocument(ownerId, baseTransaction, userIncomesDocRef);

        if (!userAnimals)
            userAnimals = await AnimalService.GetPublicAnimalsDocument(ownerId, baseTransaction);

        activitiesIncomeEntry.map(
            (activitiesIncomeEntry: ActivitiesIncomeEntry) =>
            {
                let animalId = activitiesIncomeEntry.AnimalId;
                let baseAnimal = userAnimals.AnimalsList.find((item) => item.Id == animalId);
                let sourcesIds: string[] = [];

                sourcesIds.push(activitiesIncomeEntry.AnimalId);
                sourcesIds = sourcesIds.concat(activitiesIncomeEntry.AditionalSources);


                if (!baseAnimal)
                    return;

                let animalIncomeByDay =
                    baseAnimal.Price *
                    baseAnimal.PriceMultiplier *
                    (1 / baseAnimal.DurationInDays);

                let activitiesIncome: Income =
                {
                    Id: uuidv4(),

                    Value: animalIncomeByDay,
                    Type: IcomeType.AnimalIcome,

                    WasRedeemed: false,

                    SourcesIds: sourcesIds,
                }

                userIncomesDocument.IncomesList.push(activitiesIncome);
            });

        await IncomesService.SetPublicIncomesDocument(ownerId, userIncomesDocument, baseTransaction, userIncomesDocRef);
    }


    HandleClubCommission = async (
        isFirstAnimalBuy: boolean,
        firstAnimalBonusValue: number,
        consecutiveAnimalsComissionFactor: number,
        buyerMember: AffiliatesClubMember,
        newAnimal: Animal,
        buyerPublicProfile: PublicUserProfileDocument,
        affiliatesClub: AffiliatesClubDocument
    ) =>
    {
        if (isFirstAnimalBuy)
        {
            await this.AddIndicationBonusOnFirstAnimalBuy(
                buyerMember.UserId,
                firstAnimalBonusValue,
                affiliatesClub.OwnerId,
                newAnimal);
        }
        else
        {
            await this.AddCommissionOnAnimalBuy(
                buyerMember.UserId,
                newAnimal.Price * consecutiveAnimalsComissionFactor,
                affiliatesClub.OwnerId,
                newAnimal);
        }
    }

    AddIndicationBonusOnFirstAnimalBuy = async (
        buyerUserId: string,
        indicationBonusValue: number,
        indicatedUserId: string,
        baseAnimal: Animal,
        indicatedUserIncomes: IncomesDocument | undefined = undefined) =>
    {
        if (!indicatedUserIncomes)
            indicatedUserIncomes = await IncomesService.GetPublicIncomesDocument(indicatedUserId);

        let initialAnimalIncome: Income =
        {
            Id: uuidv4(),

            Value: indicationBonusValue,
            Type: IcomeType.Indication,

            WasRedeemed: false,

            SourcesIds: [buyerUserId, baseAnimal.Id],
        }

        indicatedUserIncomes.IncomesList.push(initialAnimalIncome);

        await IncomesService.SetPublicIncomesDocument(indicatedUserId, indicatedUserIncomes);
    }

    AddCommissionOnAnimalBuy = async (
        buyerUserId: string,
        commissionValue: number,
        indicatedUserId: string,
        baseAnimal: Animal,
        indicatedUserIncomes: IncomesDocument | undefined = undefined) =>
    {
        if (!indicatedUserIncomes)
            indicatedUserIncomes = await IncomesService.GetPublicIncomesDocument(indicatedUserId);

        let initialAnimalIncome: Income =
        {
            Id: uuidv4(),

            Value: commissionValue,
            Type: IcomeType.Commission,

            WasRedeemed: false,

            SourcesIds: [buyerUserId, baseAnimal.Id],
        }

        indicatedUserIncomes.IncomesList.push(initialAnimalIncome);

        await IncomesService.SetPublicIncomesDocument(indicatedUserId, indicatedUserIncomes);
    }

    static RegisterAnimalSell = async (
        baseUserId: string,
        animalToSellId: string,
        userIncomes: IncomesDocument | undefined = undefined,
        userAnimals: AnimalsDocument | undefined = undefined,
    ) =>
    {
        let animalSellResult: AnimalSellResult =
        {
            Success: false,
            Errors: []
        }

        if (!userIncomes)
            userIncomes = await IncomesService.GetPublicIncomesDocument(baseUserId);

        if (!userAnimals)
            userAnimals = await AnimalService.GetPublicAnimalsDocument(baseUserId);

        let selledAnimal = userAnimals.AnimalsList.find(animal => animal.Id == animalToSellId)

        if (selledAnimal)
        {
            let wasAlreadySold = selledAnimal.WasSold;

            if (!wasAlreadySold)
            {
                let hasMinActiveMembersToSell = false;
                let minActiveMembersToSell = AppConfigService.GetAppConfigDocument().AffiliatesClubConfig.MinActiveMembersToSellAnimal;

                if (minActiveMembersToSell <= 0)
                    hasMinActiveMembersToSell = true;
                else
                {
                    let clubActiveMembersAmountToWithdraw = await _affiliatesClubService.GetActiveClubMembersAmount(baseUserId);
                    hasMinActiveMembersToSell = clubActiveMembersAmountToWithdraw >= minActiveMembersToSell;
                }

                if (hasMinActiveMembersToSell)
                {
                    selledAnimal.WasSold = true;

                    let animalIcomesList: Income[] =
                        userIncomes.IncomesList.filter(
                            (icome) =>
                            {
                                let isValidAnimalIcome =
                                    !icome.WasRedeemed &&
                                    icome.Type == IcomeType.AnimalIcome &&
                                    icome.SourcesIds.includes(animalToSellId);

                                return isValidAnimalIcome;
                            })

                    console.log(
                        '#> RegisterAnimalSell 01 | animalIcomesList = ',
                        animalIcomesList)

                    let sellSourcesIds: string[] = [animalToSellId];
                    let animalIncomesSum: number = 0;

                    animalIcomesList.map(
                        (income) =>
                        {
                            income.WasRedeemed = true;

                            sellSourcesIds.push(income.Id);
                            animalIncomesSum += income.Value;
                        });

                    let animalSellNewIncome: Income =
                    {
                        Id: uuidv4(),

                        Value: animalIncomesSum,
                        Type: IcomeType.AnimalSell,

                        WasRedeemed: false,

                        SourcesIds: sellSourcesIds,
                    }

                    userIncomes.IncomesList.push(animalSellNewIncome);

                    console.log(
                        '#> RegisterAnimalSell 02 | animalIcomesList = ',
                        animalIcomesList)

                    await IncomesService.SetPublicIncomesDocument(baseUserId, userIncomes);
                    await AnimalService.SetPublicAnimalsDocument(baseUserId, userAnimals);

                    animalSellResult.Success = true;
                }
                else
                {
                    animalSellResult.Errors.push('not-enough-active-members-on-club');
                    animalSellResult.Errors.push(minActiveMembersToSell.toString())
                }
            }
            else
                animalSellResult.Errors.push('animal-was-already-sold');
        }
        else
            animalSellResult.Errors.push('animal-not-in-inventory');

        return animalSellResult;
    }

    static GetAvailableIcomesSum = async (
        ownerId: string | undefined = undefined,
        userIncomesDocument: IncomesDocument | undefined = undefined,
    ) =>
    {
        let value: number = 0;

        if (userIncomesDocument == undefined)
        {
            if (ownerId)
                userIncomesDocument = await IncomesService.GetPublicIncomesDocument(ownerId);
            else
            {
                console.error(
                    '$$ > ' +
                    'ERROR trying to GetAvailableIcomesSum | ' +
                    'ownerId IS UNDEFINED!!!',
                );

                throw new Error('ownerId IS UNDEFINED');
            }
        }

        if (userIncomesDocument)
        {
            let availableIcomes: Income[] = [];

            availableIcomes = await IncomesService.GetAvailableIcomes(ownerId, userIncomesDocument);

            availableIcomes.map(
                (income: Income) => 
                {
                    value += income.Value;
                });
        }

        return value;
    }

    static GetAvailableIcomes = async (
        ownerId: string | undefined = undefined,
        userIncomesDocument: IncomesDocument | undefined = undefined,
    ) =>
    {
        let value: Income[] = [];

        if (userIncomesDocument == undefined)
        {
            if (ownerId)
                userIncomesDocument = await IncomesService.GetPublicIncomesDocument(ownerId);
            else
            {
                console.error(
                    '$$ > ' +
                    'ERROR trying to GetAvailableIcomesSum | ' +
                    'ownerId IS UNDEFINED!!!',
                );

                throw new Error('ownerId IS UNDEFINED');
            }
        }

        if (userIncomesDocument)
        {
            userIncomesDocument.IncomesList.map(
                (income: Income | null) =>
                {
                    if (income)
                    {
                        if (!income.WasRedeemed && income.Type != IcomeType.AnimalIcome && income.Type != IcomeType.UNDEFINED)
                            value.push(income);
                    }
                })
        }

        return value;
    }

    AddAdminIncome = async (
        userId: string,
        incomeValue: number,
        adminId: string,
        userIncomesDocument: IncomesDocument | undefined = undefined) =>
    {
        if (!userIncomesDocument)
            userIncomesDocument = await IncomesService.GetPublicIncomesDocument(userId);

        let initialAnimalIncome: Income =
        {
            Id: uuidv4(),

            Value: incomeValue,
            Type: IcomeType.DirectByAdmin,

            WasRedeemed: false,

            SourcesIds: [adminId],
        }

        userIncomesDocument.IncomesList.push(initialAnimalIncome);

        await IncomesService.SetPublicIncomesDocument(userId, userIncomesDocument);
    }
}

export let _incomesService: IncomesService = new IncomesService();




export interface ActivitiesIncomeEntry
{
    AnimalId: string,
    AditionalSources: string[],
}

export interface IncomesDocument
{
    OwnerId: string,
    IncomesList: Array<Income>,
}

export interface Income
{
    Id: string;

    Value: number;
    Type: IcomeType;

    WasRedeemed: boolean;

    SourcesIds: Array<string>;
}

export enum IcomeType
{
    UNDEFINED = -1,

    AnimalIcome,
    AnimalSell,
    Commission,
    Indication,
    DirectByAdmin,
}


export interface AnimalSellResult 
{
    Success: boolean,
    Errors: string[],
}
