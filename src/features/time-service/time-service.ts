// base
// ...

// third
import { DocumentData, DocumentSnapshot, getFirestore, WriteResult } from 'firebase-admin/firestore';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { GetDefaultFirestore, SetDocData } from '../firebase-admin/firebase-admin';
const admin = require("firebase-admin");


// from project
import { EnvironmentHandler } from '../environment-handler/environment-handler';



export class TimeService
{
    // dependencies
    // _firestore: Firestore = inject(Firestore);

    // state
    OnFakeTimeUpdateCallback: (() => void) | undefined = undefined;
    _hasToForceFakeTime: boolean = true;
    // _hasToForceFakeTime: boolean = false;
    _fakeTimeDate: Date = new Date('2024-04-27T14:59:59.999Z');

    GetUtcNow = () =>
    {
        let value;

        if (this._hasToForceFakeTime)
        {
            // console.warn(
            //     '$$$ > ' +
            //     'FAKE TIME SIMULATION IS ENABLED!!!' + ' | ' +
            //     '_fakeTimeDate = ' + this._fakeTimeDate +
            //     '');

            value = this._fakeTimeDate;
        }
        else
            value = new Date();

        return value;
    }

    TryToSubscribeAllListeners = () =>
    {
        if (this._hasToForceFakeTime)
        {
            // console.warn(
            //     '$$$ > ' +
            //     'FAKE TIME SIMULATION IS ENABLED!!!' + ' | ' +
            //     '_fakeTimeDate = ' + this._fakeTimeDate +
            //     '');

            const db = GetDefaultFirestore();
            const unsub =
                db
                    .collection(EnvironmentHandler.GetEnviromentCollectionPrefix() + 'DEBUG-public-fake-time')
                    .doc('fake-time')
                    .onSnapshot(
                        (doc) =>
                        {
                            let fakeTimeDocument: FakeTimeDocument = doc.data() as FakeTimeDocument;
                            this._fakeTimeDate = new Date(fakeTimeDocument.FakeUtcNotDate);

                            console.log(
                                '#> "fake-time" document update!' + ' | ' +
                                'FakeUtcNotDate = ' + fakeTimeDocument.FakeUtcNotDate +
                                '');

                            if (this.OnFakeTimeUpdateCallback)
                                this.OnFakeTimeUpdateCallback();
                        }
                    )
        }
    }

    SetTimeDocument = async (fakeTimeDocument: FakeTimeDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'DEBUG-public-fake-time',
            'fake-time',
            fakeTimeDocument,
        );
    }
}

export let _timeService: TimeService = new TimeService();

export interface FakeTimeDocument
{
    FakeUtcNotDate: string,
}
