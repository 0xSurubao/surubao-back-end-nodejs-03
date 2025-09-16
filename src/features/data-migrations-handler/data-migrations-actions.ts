// base
// ...

// from project
import { AppConfigService } from "../app-config-service/app-config-service"
import { EnvironmentHandler } from "../environment-handler/environment-handler"
import { SetDocData } from "../firebase-admin/firebase-admin"
import { AnimalStoreItem, SlotStoreItem, StoreConfigDocument } from "../store-service/store-service"
import { _timeService, FakeTimeDocument } from "../time-service/time-service"


export class DataMigrationsActions
{
    // configs
    static _defaultAnimalsByAppName: { [key: string]: AnimalStoreItem[] } =
        {
            'af-01':
                [
                    {
                        Id: 'c0755e03-29de-45e5-a287-47efb2e7f6b5',

                        type: 'AnimalStoreItem',
                        Type: 'chicken-01',

                        Price: 5,

                        PriceMultiplier: 1.8,
                        DurationInDays: 7,

                        IsVisible: true,
                        ReleaseDateTime: '2024-01-01T00:00:00-03:00',
                    },
                    {
                        Id: 'f6cc5446-6896-441a-8964-10d10748c54d',

                        type: 'AnimalStoreItem',
                        Type: 'pig-01',

                        Price: 2,

                        PriceMultiplier: 1.8,
                        DurationInDays: 9,

                        IsVisible: true,
                        ReleaseDateTime: '2024-01-01T00:00:00-03:00',
                    },
                    {
                        Id: '2e05a881-fd52-4733-a9f2-33e016396424',

                        type: 'AnimalStoreItem',
                        Type: 'sheep-01',

                        Price: 3,

                        PriceMultiplier: 1.8,
                        DurationInDays: 11,

                        IsVisible: true,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                    {
                        Id: '6f9218aa-f521-4b53-8caf-400b7e3aaa23',

                        type: 'AnimalStoreItem',
                        Type: 'dog-01',

                        Price: 2,

                        PriceMultiplier: 1.8,
                        DurationInDays: 13,

                        IsVisible: false,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                    {
                        Id: '6a608ee8-56f0-42d7-8f2b-9864afd9fe89',

                        type: 'AnimalStoreItem',
                        Type: 'cow-01',

                        Price: 3,

                        PriceMultiplier: 1.8,
                        DurationInDays: 15,

                        IsVisible: false,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                ],
            'af-02':
                [
                    {
                        Id: '8a563603-9576-4ece-82fd-15ab2fd5076f',

                        type: 'AnimalStoreItem',
                        Type: 'tiger-01',

                        Price: 5,

                        PriceMultiplier: 1.8,
                        DurationInDays: 7,

                        IsVisible: true,
                        ReleaseDateTime: '2024-01-01T00:00:00-03:00',
                    },
                    {
                        Id: '2e05a881-fd52-4733-a9f2-33e016396124',

                        type: 'AnimalStoreItem',
                        Type: 'zebra-01',

                        Price: 1,

                        PriceMultiplier: 1.8,
                        DurationInDays: 9,

                        IsVisible: true,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                    {
                        Id: '2e05a881-fd52-4735-a9f2-33e016396424',

                        type: 'AnimalStoreItem',
                        Type: 'giraffe-01',

                        Price: 3,

                        PriceMultiplier: 1.8,
                        DurationInDays: 11,

                        IsVisible: true,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                    {
                        Id: '2e05a881-fd32-4733-a9f2-33e016396424',

                        type: 'AnimalStoreItem',
                        Type: 'gorilla-01',

                        Price: 2,

                        PriceMultiplier: 1.8,
                        DurationInDays: 13,

                        IsVisible: true,
                        ReleaseDateTime: '2024-05-01T00:00:00-03:00',
                    },
                    {
                        Id: '3d25eb21-9cae-4fc8-9502-d24bd15c2003',

                        type: 'AnimalStoreItem',
                        Type: 'bull-01',

                        Price: 10,

                        PriceMultiplier: 1.8,
                        DurationInDays: 15,

                        IsVisible: true,
                        ReleaseDateTime: '2024-01-01T00:00:00-03:00',
                    },
                ],
        }

    static GetDefaultAnimalsStoreItemList = () =>
    {
        let appName = process.env.APP_NAME;

        if (!appName)
        {
            appName = 'af-01';
            console.error(
                'process.env.APP_NAME IS UNDEFINED!' + '\n' +
                'unsing "' + appName + '" insted',
            );
        }

        let value = DataMigrationsActions._defaultAnimalsByAppName[appName];

        return value;
    }

    static RegisterInitialStoreConfig = async () =>
    {
        let defaultAnimalsStoreItemList = DataMigrationsActions.GetDefaultAnimalsStoreItemList();

        let slot0: SlotStoreItem =
        {
            Id: 'a190cc5e-ebc8-41f1-ac20-7fb3748c9117',
            Index: 0,

            type: 'SlotStoreItem',

            Price: 0,
            ReleaseDateTime: '1970-01-01T00:00:00.000Z',
            IsVisible: true,
        }

        let slot1: SlotStoreItem =
        {
            Id: 'd814d575-4ec5-46b4-9e79-bb193d36a933',
            Index: 1,

            type: 'SlotStoreItem',

            Price: 500,
            ReleaseDateTime: '1970-01-01T00:00:00.000Z',
            IsVisible: true,
        }

        let slot2: SlotStoreItem =
        {
            Id: 'ebe526b7-1b5f-49ad-9212-9f3e75c050ec',
            Index: 2,

            type: 'SlotStoreItem',

            Price: 1100,
            ReleaseDateTime: '2025-01-01T00:00:00.000Z',
            IsVisible: true,
        }

        let document: StoreConfigDocument =
        {
            AnimalsStoreItemList: defaultAnimalsStoreItemList,

            SlotStoreItemList:
                [
                    slot0,
                    slot1,
                    slot2,
                ],
        }

        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'app-config-private',
            'store-config',
            document,
        );
    }

    static RegisterInitialFakeTimeConfig = async () =>
    {
        let fakeTimeDocument: FakeTimeDocument =
        {
            FakeUtcNotDate: '2025-07-22T01:30:00.000Z',
        }

        await _timeService.SetTimeDocument(fakeTimeDocument);
    }

    static RegisterInitialLevelConfig = async () =>
    {
        let document: LevelConfigDocument =
        {
            LevelDataList:
                [
                    {
                        Level: 1,
                        MaxAnimalsAmount: 1,
                        MinActiveMembersAmount: 0,
                    },
                    {
                        Level: 2,
                        MaxAnimalsAmount: 2,
                        MinActiveMembersAmount: 6,
                    },
                    {
                        Level: 3,
                        MaxAnimalsAmount: 3,
                        MinActiveMembersAmount: 9,
                    },
                    {
                        Level: 4,
                        MaxAnimalsAmount: 4,
                        MinActiveMembersAmount: 12,
                    },
                    {
                        Level: 5,
                        MaxAnimalsAmount: 5,
                        MinActiveMembersAmount: 15,
                    },
                ]
        };

        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'app-config-public',
            'level-config',
            document,
        );
    }

    static RegisterInitialAppConfigData = async () =>
    {
        let document = AppConfigService.GetDefaultAppConfigDocument();

        await AppConfigService.SetAppConfigDocument(document);
    }

    static AddMinClubActiveMembersAmountToWithdrawOnWithdrawConfig = async () =>
    {
        let document = AppConfigService.GetAppConfigDocument();
        let defaultDocument = AppConfigService.GetDefaultAppConfigDocument();

        document.WithdrawConfig.MinClubActiveMembersAmountToWithdraw =
            defaultDocument.WithdrawConfig.MinClubActiveMembersAmountToWithdraw;

        await AppConfigService.SetAppConfigDocument(document);
    }

    static AddAlternativeIndicationBonusValueByActiveMemberOnAffiliatesClubConfig = async () =>
    {
        let document = AppConfigService.GetAppConfigDocument();
        let defaultDocument = AppConfigService.GetDefaultAppConfigDocument();

        document.AffiliatesClubConfig.AlternativeIndicationBonusValueByActiveMember =
            defaultDocument.AffiliatesClubConfig.AlternativeIndicationBonusValueByActiveMember;

        await AppConfigService.SetAppConfigDocument(document);
    }
}







export interface LevelConfigDocument
{
    LevelDataList: Array<LevelData>,
}

export interface LevelData
{
    Level: number,
    MaxAnimalsAmount: number,
    MinActiveMembersAmount: number,
}
