// base
// ...

// third
import { DocumentData, DocumentReference, DocumentSnapshot, Firestore, getFirestore, Transaction, WriteResult } from 'firebase-admin/firestore';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { messaging } from "firebase-admin";
const admin = require("firebase-admin");

// from project
// ...

// configs
import { FirebaseAdminCredentialsKey as serviceAccount } from './../../../firebase-admin-credentials'


export const FirebaseApp =
    admin.apps.length ?
        admin.app() :
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

export const Messaging = () =>
{
    return messaging(FirebaseApp);
}

let _defaultFirestore: Firestore | undefined = undefined;

export const GetDefaultFirestore = (): Firestore => 
{
    let value: Firestore;

    if (!_defaultFirestore)
        _defaultFirestore = getFirestore();

    value = _defaultFirestore;

    return value;
}



export const GetFullCollectionData = async function (path: string)
{
    const db = GetDefaultFirestore();

    let collectionDataSnap = await db.collection(path).get();
    collectionDataSnap.docs.map(
        (doc) =>
        {
            console.log("doc.data = ");
            console.log(doc.data());
        }
    )
}

export const GetDocRef = (
    collection: string,
    document: string,
) =>
{
    const db = GetDefaultFirestore();

    const docRef = db.collection(collection).doc(document);

    return docRef;
}

export const GetDocData = async (
    collection: string,
    document: string,
    baseTransaction: Transaction | undefined = undefined,
    docRef: DocumentReference<DocumentData, DocumentData> | undefined = undefined,
) =>
{
    const db = GetDefaultFirestore();

    let documentSnapshot: DocumentSnapshot<DocumentData, DocumentData>;

    if (baseTransaction == undefined)
    {
        // console.log('< [WO/T] | ', collection, '/', document);
        documentSnapshot = await db.collection(collection).doc(document).get();
    }
    else
    {
        if (!docRef)
            docRef = db.collection(collection).doc(document);

        documentSnapshot = await baseTransaction.get(docRef);
    }

    return documentSnapshot.data();
}

export const SetDocData = async (
    collection: string,
    document: string,
    data: any,
    baseTransaction: Transaction | undefined = undefined,
    docRef: DocumentReference<DocumentData, DocumentData> | undefined = undefined,
): Promise<WriteResult | Transaction> =>
{
    const db = GetDefaultFirestore();

    let writeResult: WriteResult | Transaction;

    if (baseTransaction == undefined)
    {
        // console.log('> [WO/T] | ', collection, '/', document);
        writeResult = await db.collection(collection).doc(document).set(data);
    }
    else
    {
        if (!docRef)
            docRef = db.collection(collection).doc(document);

        writeResult = await baseTransaction.set(docRef, data);
    }

    return writeResult;
}

export async function GetUserIdByToken(baseIdToken: string): Promise<string | undefined>
{
    let value: string | undefined = undefined;

    let decodedToken: DecodedIdToken = await getAuth().verifyIdToken(baseIdToken);

    if (decodedToken)
        value = decodedToken.uid;

    return value;
}
