// base
import { v4 as uuidv4 } from 'uuid';

// from project
import { GetDefaultFirestore, GetDocData, GetDocRef, SetDocData } from '../firebase-admin/firebase-admin';
import { ConvertUtcDateToBrazilianDayDateStart, ConvertUtcDateToBrazilianDayKey, GetRandomInt } from '../utils/project-utils';
import { ActivitiesIncomeEntry, IncomesDocument, IncomesService } from '../incomes-service/incomes-service';
import { _mailService, MailData, MailService, MailType } from '../mail-service/mail-service';
import { _animalService, Animal, AnimalsDocument, AnimalService } from '../animals-service/animals-service';
import { _timeService } from '../time-service/time-service';
import { Transaction } from 'firebase-admin/firestore';
import { EnvironmentHandler } from '../environment-handler/environment-handler';


export class ActivitiesService
{
    static GetPublicActivitiesDocument = async (ownerId: string) =>
    {
        let document: ActivitiesDocument_PUBLIC =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-activities-private',
                ownerId) as ActivitiesDocument_PUBLIC;

        if (!document)
        {
            document =
            {
                IS_PUBLIC: true,

                UserId: ownerId,
                ActivitiesByDate: {},
                IsActivitiesValidatedByDate: {},
            }
        }

        document.IS_PUBLIC = true;

        // ! DEBUG ONLY!!!!
        // ! DEBUG ONLY!!!!
        // ! DEBUG ONLY!!!!
        // ! DEBUG ONLY!!!!
        // let utcNow = new Date('2024-04-11T02:08:34.521Z');
        let utcNow = _timeService.GetUtcNow();

        if (document)
        {
            if (!document.ActivitiesByDate)
                document.ActivitiesByDate = {};
        }

        let publicActivitiesByDate: { [key: string]: Activity[] } = {};
        let activitiesByDate: { [key: string]: Activity[] } = document.ActivitiesByDate;

        Object.keys(activitiesByDate).forEach(
            (key) =>
            {
                const activitiesList = activitiesByDate[key];
                publicActivitiesByDate[key] = [];

                activitiesList.map(
                    (activity: Activity) =>
                    {
                        let startDate = new Date(activity.StartDate);
                        let deadLineDate = new Date(activity.DeadLineDate);

                        let isInTimeInterval: boolean =
                            utcNow.getTime() >= startDate.getTime() &&
                            utcNow.getTime() <= deadLineDate.getTime();

                        if (isInTimeInterval)
                            publicActivitiesByDate[key].push(activity);
                    })
            })

        document.ActivitiesByDate = publicActivitiesByDate;

        return document;
    }

    static GetPrivateActivitiesDocRef = (ownerId: string) =>
    {
        let docRef = GetDocRef(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-activities-private',
            ownerId,
        );

        return docRef;
    }

    static GetPrivateActivitiesDocument = async (
        ownerId: string,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        let document: ActivitiesDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-activities-private',
                ownerId,
                baseTransaction,
            ) as ActivitiesDocument;

        if (!document)
        {
            document =
            {
                UserId: ownerId,
                ActivitiesByDate: {},
                IsActivitiesValidatedByDate: {},
            }
        }

        if (!document.IsActivitiesValidatedByDate)
            document.IsActivitiesValidatedByDate = {};

        return document;
    }

    static SetPrivateActivitiesDocument = async (
        ownerId: string,
        docuent: ActivitiesDocument,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        if (!IsPublicDocument(docuent))
        {
            await SetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'user-activities-private',
                ownerId,
                docuent,
                baseTransaction,
            );
        }
        else
        {
            console.error(
                '$$$ > ' +
                'Your have tryied to replace a private document ' +
                'with a "public" (filtered version) one, ' +
                'that is NOT ALLOWED!')
        }
    }

    RegisterAnimalActivities = async (
        ownerId: string,
        animalId: string,
        daysAmount: number,
        activitiesDocument: ActivitiesDocument | undefined = undefined,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        if (!activitiesDocument)
            activitiesDocument = await ActivitiesService.GetPrivateActivitiesDocument(ownerId, baseTransaction);

        let utcNow = _timeService.GetUtcNow();
        let activitiesDatesList: Array<Date> = [];

        for (let i = 1; i < daysAmount; i++)
        {
            let dayOffset = i * 24 * 60 * 60 * 1000;

            let newDate = new Date(utcNow.getTime() + dayOffset);
            activitiesDatesList.push(newDate);
        }

        activitiesDatesList.map(
            (dayDate: Date) =>
            {
                activitiesDocument.ActivitiesByDate =
                    this.TryToAddActivityOnList(
                        animalId,
                        dayDate,
                        activitiesDocument.ActivitiesByDate);
            });

        await ActivitiesService.SetPrivateActivitiesDocument(ownerId, activitiesDocument, baseTransaction);
    }

    TryToAddActivityOnList = (animalId: string, baseStartBrazilianDate: Date, baseActivitiesByBrazilianDate: { [key: string]: Activity[] }) =>
    {
        let dayEndOffset: number = (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000);
        let dayStartDate: Date = ConvertUtcDateToBrazilianDayDateStart(baseStartBrazilianDate);
        let dayEndDate: Date = new Date(dayStartDate.getTime() + dayEndOffset);
        let brazilianDateDayKey: string = ConvertUtcDateToBrazilianDayKey(baseStartBrazilianDate);

        // feed animal
        let minFeedActivityOffsetInMs = 8 * 60 * 60 * 1000;
        let maxFeedActivityOffsetInMs = 12 * 60 * 60 * 1000;
        // medicate animal
        let minMedicateActivityOffsetInMs = 14 * 60 * 60 * 1000;
        let maxMedicateActivityOffsetInMs = 16 * 60 * 60 * 1000;
        // clean farm
        let minCleanFarmActivityOffsetInMs = 18 * 60 * 60 * 1000;
        let maxCleanFarmActivityOffsetInMs = 21 * 60 * 60 * 1000;

        // final ofssets
        let randomFeedActivityOffsetInMs = GetRandomInt(minFeedActivityOffsetInMs, maxFeedActivityOffsetInMs);
        let randomMedicateActivityOffsetInMs = GetRandomInt(minMedicateActivityOffsetInMs, maxMedicateActivityOffsetInMs);
        let randomCleanFarmActivityOffsetInMs = GetRandomInt(minCleanFarmActivityOffsetInMs, maxCleanFarmActivityOffsetInMs);

        // final dates
        let feedStartDate: Date = new Date(dayStartDate.getTime() + randomFeedActivityOffsetInMs);
        let medicateStartDate: Date = new Date(dayStartDate.getTime() + randomMedicateActivityOffsetInMs);
        let cleanFarmStartDate: Date = new Date(dayStartDate.getTime() + randomCleanFarmActivityOffsetInMs);

        let dayEntry: Activity[] = [];

        if (brazilianDateDayKey in baseActivitiesByBrazilianDate)
            dayEntry = baseActivitiesByBrazilianDate[brazilianDateDayKey];

        let cleanFarmActivity: Activity | undefined = dayEntry.find(item => item.Type == ActivityType.CleanFarm);

        if (!cleanFarmActivity)
        {
            // has no clean activity yet
            cleanFarmActivity =
            {
                Id: uuidv4(),
                Type: ActivityType.CleanFarm,

                WasDone: false,
                WasValidated: false,
                SourceId: '',

                StartDate: cleanFarmStartDate.toISOString(),
                DeadLineDate: dayEndDate.toISOString(),
            };

            dayEntry.push(cleanFarmActivity);
        }
        else
        {
            // already has a clean activity
            let feedAnimalActivity: Activity | undefined = dayEntry.find(item => item.Type == ActivityType.FeedAnimal);
            let medicateActivity: Activity | undefined = dayEntry.find(item => item.Type == ActivityType.MedicateAnimal);

            if (feedAnimalActivity)
                feedStartDate = new Date(feedAnimalActivity.StartDate);

            if (medicateActivity)
                medicateStartDate = new Date(medicateActivity.StartDate);
        }

        let feedActivity: Activity =
        {
            Id: uuidv4(),
            Type: ActivityType.FeedAnimal,

            WasDone: false,
            WasValidated: false,
            SourceId: animalId,

            StartDate: feedStartDate.toISOString(),
            DeadLineDate: dayEndDate.toISOString(),
        };

        let medicateActivity: Activity =
        {
            Id: uuidv4(),
            Type: ActivityType.MedicateAnimal,

            WasDone: false,
            WasValidated: false,
            SourceId: animalId,

            StartDate: medicateStartDate.toISOString(),
            DeadLineDate: dayEndDate.toISOString(),
        };

        dayEntry.push(feedActivity);
        dayEntry.push(medicateActivity);

        baseActivitiesByBrazilianDate[brazilianDateDayKey] = dayEntry;

        return baseActivitiesByBrazilianDate;
    }

    MarkActivitiesAsDone = async (
        ownerId: string,
        activitiesIdsList: string[],
    ) =>
    {
        let callId = uuidv4();

        let successActivitiesIdsList: string[] = [];

        try
        {
            let firestore = GetDefaultFirestore();
            // let okActivitiesIncomeEntry: ActivitiesIncomeEntry[] = [];

            let byTransactionSuccessActivitiesIdsList: string[] = [];

            await firestore.runTransaction(async (transaction) =>
            {
                byTransactionSuccessActivitiesIdsList = [];









                let activitiesDocRef = ActivitiesService.GetPrivateActivitiesDocRef(ownerId);
                let activitiesDocument: ActivitiesDocument = (await transaction.get(activitiesDocRef)).data() as ActivitiesDocument;


                // if (!activitiesDocument)
                //     activitiesDocument = await ActivitiesService.GetPrivateActivitiesDocument(ownerId, transaction);

                if (activitiesDocument)
                {
                    if (!activitiesDocument.ActivitiesByDate)
                        activitiesDocument.ActivitiesByDate = {};
                }


                let activitiesByDate: { [key: string]: Activity[] } = activitiesDocument.ActivitiesByDate;

                Object.keys(activitiesByDate).forEach(
                    (key) =>
                    {
                        const activitiesList = activitiesByDate[key];

                        activitiesList.map(
                            (activity: Activity) =>
                            {
                                // ! DEBUG ONLY!!!!
                                // ! DEBUG ONLY!!!!
                                // ! DEBUG ONLY!!!!
                                // ! DEBUG ONLY!!!!
                                // let utcNow = new Date('2024-04-11T02:08:34.521Z');
                                let utcNow = _timeService.GetUtcNow();

                                let startDate = new Date(activity.StartDate);
                                let deadLineDate = new Date(activity.DeadLineDate);

                                let isInTimeInterval: boolean =
                                    utcNow.getTime() >= startDate.getTime() &&
                                    utcNow.getTime() <= deadLineDate.getTime();

                                if (isInTimeInterval)
                                {
                                    let isInRequestList = activitiesIdsList.find(id => id == activity.Id);
                                    if (isInRequestList)
                                    {
                                        activity.WasDone = true;
                                        byTransactionSuccessActivitiesIdsList.push(activity.Id);
                                    }
                                }
                            })
                    })

                activitiesDocument.ActivitiesByDate = activitiesByDate;

                await transaction.set(activitiesDocRef, activitiesDocument);
                // await ActivitiesService.SetPrivateActivitiesDocument(ownerId, activitiesDocument, transaction);












            });





            // okActivitiesIncomeEntry
            // console.log(
            //     '####>>> 02-01-02 | (' + callId.substring(0, 4) + ') | okActivitiesIncomeEntry =' + '\n',
            //     okActivitiesIncomeEntry,
            // )

            // console.log('### MarkActivitiesAsDone | Transaction successfully committed!!!' + ' | 02-02 (' + callId.substring(0, 4) + ')');

            successActivitiesIdsList = byTransactionSuccessActivitiesIdsList;
        } catch (error)
        {
            console.error(
                '$$$ > MarkActivitiesAsDone | 03 (', ownerId, ') Transaction failed (' + callId.substring(0, 4) + '): ' + '\n',
                error);
        }

        return successActivitiesIdsList;
    }

    static ForceActivitiesValidation = async (
        ownerId: string,
        hasToIncludeCurrentDay: boolean): Promise<boolean> => 
    {
        let value = false;

        let callId = uuidv4();

        // *
        // console.log(
        //     '### ForceActivitiesValidation | ownerId = ',
        //     ownerId,
        //     ' | 01 (' + callId.substring(0, 4) + ')'
        // );

        try
        {
            let firestore = GetDefaultFirestore();
            let okActivitiesIncomeEntry: ActivitiesIncomeEntry[] = [];

            // let userIncomesDocument: IncomesDocument | undefined = undefined;
            // let userAnimals: AnimalsDocument | undefined = undefined;
            let undoneActivitiesWarningEntries: UndoneActivitiesWarningEntry[] = [];

            await firestore.runTransaction(async (transaction) =>
            {
                okActivitiesIncomeEntry = [];
                undoneActivitiesWarningEntries = [];












                // * console.log('ForceActivitiesValidation | 02-01-01 (' + callId.substring(0, 4) + ')');

                let activitiesDocRef = ActivitiesService.GetPrivateActivitiesDocRef(ownerId);
                let activitiesDocument: ActivitiesDocument = (await transaction.get(activitiesDocRef)).data() as ActivitiesDocument;

                let userAnimalsDocRef = await AnimalService.GetPublicAnimalsDocRef(ownerId);
                let userAnimals = (await transaction.get(userAnimalsDocRef)).data() as AnimalsDocument;

                let userIncomesDocRef = await IncomesService.GetPublicIncomesDocRef(ownerId);
                let userIncomesDocument = (await transaction.get(userIncomesDocRef)).data() as IncomesDocument;

                let utcNow = _timeService.GetUtcNow();
                let nowBrazilianDateDayKey: string = ConvertUtcDateToBrazilianDayKey(utcNow);

                let pastDateKeys: Set<string> = new Set<string>();

                if (activitiesDocument == undefined)
                {
                    value = true;
                    return;
                }

                // list all not validated past days
                Object.keys(activitiesDocument.ActivitiesByDate).forEach(
                    (brazilianDayKeyDate) =>
                    {
                        let isValidated = false;

                        if (brazilianDayKeyDate in activitiesDocument.IsActivitiesValidatedByDate)
                            isValidated = activitiesDocument.IsActivitiesValidatedByDate[brazilianDayKeyDate];

                        let keyBrazilianKeyDate = new Date(brazilianDayKeyDate);
                        let nowBrazilianKeyDate = new Date(nowBrazilianDateDayKey);

                        let isPastKey = keyBrazilianKeyDate.getTime() < nowBrazilianKeyDate.getTime();
                        let isCurrentDay = keyBrazilianKeyDate.getTime() == nowBrazilianKeyDate.getTime();

                        let hasToIncludDay: boolean =
                            (isPastKey && !isValidated) ||
                            (hasToIncludeCurrentDay && isCurrentDay);

                        if (hasToIncludDay)
                            pastDateKeys.add(brazilianDayKeyDate);
                    })

                // console.log(
                //     '\n' +
                //     '# pastDateKeys = ', pastDateKeys,
                // );


                // validate all activities of all past days
                if (pastDateKeys.size > 0)
                {


                    pastDateKeys.forEach(
                        (brazilianDayKeyDate) =>
                        {
                            let dayEntry = activitiesDocument.ActivitiesByDate[brazilianDayKeyDate];
                            let isCurrentDay = nowBrazilianDateDayKey == brazilianDayKeyDate;

                            if (dayEntry)
                            {
                                // console.log(
                                //     '############ ForceActivitiesValidation | 02-01-02 (' + callId.substring(0, 4) + ') | dayEntry = \n',
                                //     dayEntry,
                                // )

                                let cleanFarmActivity: Activity | undefined =
                                    dayEntry.find(item => item.Type == ActivityType.CleanFarm);

                                let hasCleanedFarm = false;

                                if (cleanFarmActivity)
                                    hasCleanedFarm = cleanFarmActivity.WasDone;

                                let animalsIds: Set<string> = new Set<string>();
                                let feedActivitiesByAnimal: { [key: string]: Activity } = {};
                                let medicateActivitiesByAnimal: { [key: string]: Activity } = {};

                                dayEntry.map(
                                    (activity: Activity) =>
                                    {
                                        let animalId;

                                        switch (activity.Type)
                                        {

                                        case ActivityType.FeedAnimal:
                                            {
                                                animalId = activity.SourceId;
                                                animalsIds.add(animalId);
                                                feedActivitiesByAnimal[animalId] = activity;
                                                break;
                                            }

                                        case ActivityType.MedicateAnimal:
                                            {
                                                animalId = activity.SourceId;
                                                animalsIds.add(animalId);
                                                medicateActivitiesByAnimal[animalId] = activity;
                                                break;
                                            }

                                        }
                                    });

                                animalsIds.forEach(
                                    (animalId: string) =>
                                    {
                                        let feedAnimalActivity: Activity = feedActivitiesByAnimal[animalId];
                                        let medicateAnimalActivity: Activity = medicateActivitiesByAnimal[animalId];

                                        let allAnimalsActivitiesWasDone =
                                            hasCleanedFarm &&
                                            feedAnimalActivity.WasDone &&
                                            medicateAnimalActivity.WasDone;

                                        if (allAnimalsActivitiesWasDone)
                                        {
                                            let allAnimalsActivitiesWasAlreadyValidated =
                                                feedAnimalActivity.WasValidated &&
                                                medicateAnimalActivity.WasValidated;

                                            // * console.log(
                                            //     '############ ForceActivitiesValidation | 02-01-02 (' + callId.substring(0, 4) + ') | dayEntry = \n',
                                            //     dayEntry, '\n',
                                            //     'allAnimalsActivitiesWasAlreadyValidated = ', allAnimalsActivitiesWasAlreadyValidated, '\n',
                                            //     'feedAnimalActivity.WasValidated = ', feedAnimalActivity.WasValidated, '\n',
                                            //     'medicateAnimalActivity.WasValidated = ', medicateAnimalActivity.WasValidated, '\n',
                                            // )

                                            // console.log(
                                            //     'allAnimalsActivitiesWasAlreadyValidated = ', allAnimalsActivitiesWasAlreadyValidated, '\n',
                                            //     'feedAnimalActivity.WasValidated = ', feedAnimalActivity.WasValidated, '\n',
                                            //     'medicateAnimalActivity.WasValidated = ', medicateAnimalActivity.WasValidated, '\n',
                                            // )

                                            if (allAnimalsActivitiesWasAlreadyValidated == false)
                                            {
                                                feedAnimalActivity.WasValidated = true;
                                                medicateAnimalActivity.WasValidated = true;

                                                let aditionalSources: string[] =
                                                    [
                                                        'brazilianDayKeyDate=' + brazilianDayKeyDate,
                                                        cleanFarmActivity!.Id,
                                                        feedAnimalActivity.Id,
                                                        medicateAnimalActivity.Id,
                                                    ];

                                                let animalIncomeEntry: ActivitiesIncomeEntry =
                                                {
                                                    AnimalId: animalId,
                                                    AditionalSources: aditionalSources,
                                                }

                                                okActivitiesIncomeEntry.push(animalIncomeEntry);

                                                // console.log(
                                                //     '\n\n' +
                                                //     '#### okActivitiesIncomeEntry.push(animalIncomeEntry)' + '\n' +
                                                //     '\n' +
                                                //     'brazilianDayKeyDate = ', brazilianDayKeyDate,
                                                //     '\n' + '\n',
                                                //     'animalIncomeEntry = ' + '\n',
                                                //     animalIncomeEntry,
                                                // )
                                            }
                                        }
                                        else
                                        {
                                            let undoneActivitiesWarningEntry: UndoneActivitiesWarningEntry =
                                            {
                                                AnimalId: animalId,
                                                ActivityBrazilianDateKey: brazilianDayKeyDate,
                                            }

                                            if (!isCurrentDay)
                                                undoneActivitiesWarningEntries.push(undoneActivitiesWarningEntry);
                                        }
                                    });

                                if (!isCurrentDay)
                                    activitiesDocument.IsActivitiesValidatedByDate[brazilianDayKeyDate] = true;
                            }
                        });

                    await transaction.set(activitiesDocRef, activitiesDocument);
                    // await ActivitiesService.SetPrivateActivitiesDocument(ownerId, activitiesDocument, transaction);

                    await IncomesService.AddActivitiesIncomes(
                        ownerId,
                        okActivitiesIncomeEntry,
                        userIncomesDocument,
                        userAnimals,
                        transaction,
                        userIncomesDocRef);


                }










            });





            // okActivitiesIncomeEntry
            // * console.log(
            //     '####>>> ForceActivitiesValidation | 02-01-03 | (' + callId.substring(0, 4) + ') | okActivitiesIncomeEntry =' + '\n',
            //     okActivitiesIncomeEntry,
            // )

            // * console.log('### ForceActivitiesValidation | Transaction successfully committed!!!' + ' | 02-02 (' + callId.substring(0, 4) + ')');

            // if (userIncomesDocument)
            //     await IncomesService.AddActivitiesIncomes(ownerId, okActivitiesIncomeEntry, userIncomesDocument, userAnimals);

            // await IncomesService.AddActivitiesIncomes(ownerId, okActivitiesIncomeEntry);

            await ActivitiesService.SendUndoneActivitiesAlerts(ownerId, undoneActivitiesWarningEntries);

            value = true;
        } catch (error)
        {
            console.error(
                '$$$ > ForceActivitiesValidation | 03 (', ownerId, ') Transaction failed (' + callId.substring(0, 4) + '): ' + '\n',
                error);
        }

        return value;
    }

    static GetDateText = (baseDateIsoString: string) =>
    {
        let value = '...';

        value = '';

        let dateUtc = new Date(baseDateIsoString);

        value += dateUtc.getDate().toString().padStart(2, '0');
        value += '/';
        value += (dateUtc.getMonth() + 1).toString().padStart(2, '0');
        value += '/';
        value += dateUtc.getFullYear().toString();

        return value;
    }

    static SendUndoneActivitiesAlerts = async (
        ownerId: string,
        undoneActivitiesWarningEntries: UndoneActivitiesWarningEntry[],
        userAnimals: AnimalsDocument | undefined = undefined,
        baseTransaction: Transaction | undefined = undefined,
    ) =>
    {
        let utcNow = _timeService.GetUtcNow();

        if (!userAnimals)
            userAnimals = await AnimalService.GetPublicAnimalsDocument(ownerId, baseTransaction);

        let mailsList: MailData[] = [];

        undoneActivitiesWarningEntries.map(
            (undoneActivityEntry) =>
            {
                let animalId = undoneActivityEntry.AnimalId;
                let brazilianDateKey = undoneActivityEntry.ActivityBrazilianDateKey;
                let brazilianDateKeyText = ActivitiesService.GetDateText(brazilianDateKey);
                let baseAnimal = userAnimals.AnimalsList.find((item) => item.Id == animalId);

                if (baseAnimal)
                {
                    let animalName = ActivitiesService.GetAnimalName(baseAnimal);

                    let title = 'Você não fez uma atividade! (' + brazilianDateKeyText + ')';
                    let description: string[] =
                        [
                            'Você deixou de fazer alguma atividade no dia ',
                            brazilianDateKeyText,
                            ', e isso fez o animal ',
                            animalName,
                            ' não gerar rendimento nesse dia :('
                        ];

                    let mailData: MailData =
                    {
                        Id: uuidv4(),
                        OwnerId: ownerId,

                        WasRead: false,
                        CreationDateTime: utcNow.toISOString(),
                        Type: MailType.Warning,

                        Title: title,
                        Description: description,
                    }

                    mailsList.push(mailData);
                }
            }
        )

        await MailService.TryToAddMailsList(ownerId, mailsList, baseTransaction);
        await MailService.SendMailsListAsNotification(ownerId, mailsList);
    }

    static GetAnimalName = (baseAnimal: Animal) =>
    {
        let value = '...';

        switch (baseAnimal.Type)
        {

        // af-01

        case "chicken-01":
            value = "Galinha"
            break;

        case "pig-01":
            value = "Porco"
            break;

        case "cock-01":
            value = "Galo"
            break;

        case "cow-01":
            value = "Vaca"
            break;

        case "dog-01":
            value = "Cachorro"
            break;

        case "sheep-01":
            value = "Ovelha"
            break;

        case "turkey-01":
            value = "Peru"
            break;

        // af-02

        case "tiger-01":
            value = "Tigre"
            break;

        case "zebra-01":
            value = "Zebra"
            break;

        case "gorilla-01":
            value = "Gorila"
            break;

        case "giraffe-01":
            value = "Girafa"
            break;

        case "bull-01":
            value = "Touro"
            break;

        default:
            {
                value = baseAnimal.Type;

                console.error(
                    "$$$ > ERROR trying to GetAnimalName!" + "\n" +
                    "_animalStoreItemData.Type = \"" + baseAnimal.Type + "\"" + "\n" +
                    "")
                break;
            }

        }

        value += "#" + baseAnimal.Id.slice(-2);

        return value;
    }
}

export let _ativitiesService: ActivitiesService = new ActivitiesService();



function IsPublicDocument(data: any)
{
    return data.IS_PUBLIC !== undefined;
}

export interface ActivitiesDocument_PUBLIC extends ActivitiesDocument
{
    IS_PUBLIC: Boolean,
}

export interface ActivitiesDocument
{
    UserId: string,
    ActivitiesByDate: { [key: string]: Activity[] },
    IsActivitiesValidatedByDate: { [key: string]: boolean },
}

export interface Activity
{
    Id: string,
    Type: ActivityType,

    WasDone: boolean,
    WasValidated: boolean,
    SourceId: string

    StartDate: string,
    DeadLineDate: string,
}

export enum ActivityType
{
    UNDEFINED = -1,

    FeedAnimal,
    MedicateAnimal,

    CleanFarm,
}

export interface UndoneActivitiesWarningEntry
{
    AnimalId: string,
    ActivityBrazilianDateKey: string,
}
