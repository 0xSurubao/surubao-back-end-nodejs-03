// base
// ...

// third
import { DocumentData, DocumentSnapshot, getFirestore, WriteResult } from 'firebase-admin/firestore';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { GetDefaultFirestore, SetDocData } from '../firebase-admin/firebase-admin';
import { EnvironmentHandler } from '../environment-handler/environment-handler';
const admin = require("firebase-admin");


// from project
// ...


export class AppConfigService
{
    // dependencies
    // _firestore: Firestore = inject(Firestore);

    // state
    static AppConfigDocument: AppConfigDocument;

    static GetAppConfigDocument = () =>
    {
        if (AppConfigService.AppConfigDocument == undefined)
            AppConfigService.AppConfigDocument = AppConfigService.GetDefaultAppConfigDocument();

        return AppConfigService.AppConfigDocument;
    }


    TryToSubscribeAllListeners = () =>
    {
        const db = GetDefaultFirestore();
        const unsub =
            db
                .collection(EnvironmentHandler.GetEnviromentCollectionPrefix() + 'app-config-public')
                .doc('app-config')
                .onSnapshot(this.OnAppConfigUpdate);
    }

    OnAppConfigUpdate = (doc: DocumentSnapshot<DocumentData, DocumentData>) =>
    {
        AppConfigService.AppConfigDocument = doc.data() as AppConfigDocument;
    }

    static GetDefaultAppConfigDocument = () =>
    {
        let affiliatesClubConfig: AffiliatesClubConfig =
        {
            // general configs
            ActivityDurationInDays: 15,
            // actions configs
            MinActiveMembersToSellAnimal: 3,
            // affiliates commision
            IndicationBonusValueByActiveMember: 20.0,
            AlternativeIndicationBonusValueByActiveMember: 35.0,
            AnimalSellComissionFactor: 0.1,
        }

        let withdrawConfig: WithdrawConfig =
        {
            MinClubActiveMembersAmountToWithdraw: 0,

            MinWithdrawValue: 20.0,
            MaxAutomaticWithdrawValue: 50.0,

            WithdrawFeesType: 'fixed-value',
            WithdrawFeesValue: 5.0,
        }

        let value: AppConfigDocument =
        {
            AffiliatesClubConfig: affiliatesClubConfig,
            WithdrawConfig: withdrawConfig,
        }

        return value;
    }

    static SetAppConfigDocument = async (document: AppConfigDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'app-config-public',
            'app-config',
            document,
        )
    }
}

export let _appConfigService: AppConfigService = new AppConfigService();




export interface AppConfigDocument
{
    AffiliatesClubConfig: AffiliatesClubConfig,
    WithdrawConfig: WithdrawConfig,
}

export interface AffiliatesClubConfig
{
    // general configs
    ActivityDurationInDays: number,
    // actions configs
    MinActiveMembersToSellAnimal: number,
    // affiliates commision
    IndicationBonusValueByActiveMember: number,
    AlternativeIndicationBonusValueByActiveMember: number,
    AnimalSellComissionFactor: number,
}

export interface WithdrawConfig
{
    MinClubActiveMembersAmountToWithdraw: number,

    MinWithdrawValue: number,
    MaxAutomaticWithdrawValue: number,

    WithdrawFeesType: string, // 'none' / 'fixed-value' / 'percentage'
    WithdrawFeesValue: number,
}

export interface LevelConfig
{
    LevelDataList: Array<LevelData>,
}

export interface LevelData
{
    Level: number,
    MaxAnimalsAmount: number,
    MinActiveMembersAmount: number,
}
