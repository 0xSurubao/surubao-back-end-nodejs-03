// base
import { v4 as uuidv4 } from 'uuid';

// from project
import { GetDocData, SetDocData } from '../firebase-admin/firebase-admin';
import { _timeService } from '../time-service/time-service';
import { EnvironmentHandler } from '../environment-handler/environment-handler';


export class StoreService
{
    static GetPublicStoreConfig = async () =>
    {
        let value: StoreConfigDocument =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'app-config-private',
                'store-config',
            ) as StoreConfigDocument;

        if (!value)
        {
            value =
            {
                AnimalsStoreItemList: [],
                SlotStoreItemList: [],
            }
        }

        value.AnimalsStoreItemList = value.AnimalsStoreItemList.filter(item => item && item.IsVisible)
        value.SlotStoreItemList = value.SlotStoreItemList.filter(item => item && item.IsVisible)

        value.AnimalsStoreItemList.map(
            (item: AnimalStoreItem) =>
            {
                let finalObj = item;

                if (!StoreService.WasAnimalItemReleased(item.ReleaseDateTime) && item.IsVisible)
                {
                    let empityItem = StoreService.GetEmpityAnimalStoreItem();
                    empityItem.ReleaseDateTime = item.ReleaseDateTime;

                    finalObj = empityItem;
                }
            });

        value.SlotStoreItemList.map(
            (item: SlotStoreItem) =>
            {
                let finalObj = item;

                if (!StoreService.WasAnimalItemReleased(item.ReleaseDateTime) && item.IsVisible)
                {
                    let empityItem = StoreService.GetEmpitySlotStoreItem();
                    empityItem.ReleaseDateTime = item.ReleaseDateTime;

                    finalObj = empityItem;
                }
            });

        return value;
    }

    static WasAnimalItemReleased = (baseReleaseDateTime: string) =>
    {
        let value: boolean = false;

        if (baseReleaseDateTime)
        {
            let utcNow = _timeService.GetUtcNow();
            let releaseDate = new Date(baseReleaseDateTime)

            let diff = releaseDate.getTime() - utcNow.getTime();

            value = diff < 0;
        }


        return value;
    }

    static GetEmpityAnimalStoreItem = () =>
    {
        let value: AnimalStoreItem =
        {
            Id: '',

            Type: '',

            Price: 0,

            PriceMultiplier: 0,
            DurationInDays: 0,

            IsVisible: true,
            ReleaseDateTime: '',
        }

        return value;
    }

    static GetEmpitySlotStoreItem = () =>
    {
        let value: SlotStoreItem =
        {
            Id: '',

            Index: -1,
            Price: 0,

            IsVisible: true,
            ReleaseDateTime: '',
        }

        return value;
    }
}

export let _storeService: StoreService = new StoreService();


export interface StoreConfigDocument
{
    AnimalsStoreItemList: Array<AnimalStoreItem>,
    SlotStoreItemList: Array<SlotStoreItem>,
}

export interface StoreItem 
{
    Id: string;

    Price: number;

    IsVisible: boolean;
    ReleaseDateTime: string;
}

export interface AnimalStoreItem extends StoreItem
{
    type?: 'AnimalStoreItem',

    Type: string;

    PriceMultiplier: number;
    DurationInDays: number;
}

export interface SlotStoreItem extends StoreItem
{
    type?: 'SlotStoreItem',

    Index: number,
}

export interface WithdrawParameters
{
    type?: 'WithdrawParameters',

    WithdrawPixKey: string,
    WithdrawPixKeyType: string,
    FeesValue: number;
    SourceIncomesIds: string[],
}
