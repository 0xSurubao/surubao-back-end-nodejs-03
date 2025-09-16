// from project
import { EnvironmentHandler } from "../environment-handler/environment-handler";
import { GetDocData, SetDocData } from "../firebase-admin/firebase-admin";
import { _timeService, TimeService } from "../time-service/time-service";
import { DataMigrationsActions } from "./data-migrations-actions";


export class DataMigrationsHandler
{
    // configs
    static _orderedMigrationsActionsToRun: MigrationAction[] =
        [
            {
                Version: 1,
                ActionsList: [
                    DataMigrationsActions.RegisterInitialFakeTimeConfig,
                    DataMigrationsActions.RegisterInitialLevelConfig,
                    DataMigrationsActions.RegisterInitialAppConfigData,
                ]
            },
            {
                Version: 3,
                ActionsList: [
                    DataMigrationsActions.AddMinClubActiveMembersAmountToWithdrawOnWithdrawConfig,
                ]
            },
            {
                Version: 4,
                ActionsList: [
                    DataMigrationsActions.AddAlternativeIndicationBonusValueByActiveMemberOnAffiliatesClubConfig,
                ]
            },
            {
                Version: 8,
                ActionsList: [
                    DataMigrationsActions.RegisterInitialStoreConfig,
                ]
            },
        ]

    static GetMigrationData = async () =>
    {
        let document: MigrationDataDocument | undefined =
            await GetDocData(
                EnvironmentHandler.GetEnviromentCollectionPrefix() + 'data-migrations',
                'migrations-data',
            ) as (MigrationDataDocument | undefined);

        if (!document)
        {
            document = {
                CurrentVersion: 0,
                ExecutionsRegistersByVersion: {},
            };
        }

        return document;
    }

    static SetMigrationData = async (document: MigrationDataDocument) =>
    {
        await SetDocData(
            EnvironmentHandler.GetEnviromentCollectionPrefix() + 'data-migrations',
            'migrations-data',
            document,
        );
    }

    static HandleDataMigrations = async (onFinishCallback: () => void) =>
    {
        console.log('> data migrations handling started...');

        let migrationDataDocument = await DataMigrationsHandler.GetMigrationData();

        let initialMigrationVersion = migrationDataDocument.CurrentVersion;
        let currentMigrationVersion = migrationDataDocument.CurrentVersion;

        await Promise.all(
            DataMigrationsHandler._orderedMigrationsActionsToRun.map(
                async (migrationAction: MigrationAction) =>
                {
                    if (migrationAction.Version > currentMigrationVersion)
                    {
                        currentMigrationVersion = migrationAction.Version;

                        await Promise.all(
                            migrationAction.ActionsList.map(
                                async (action) => await action())
                        )

                        let utcNow = new Date();

                        let migrationExecutionRegister: MigrationExecutionRegister =
                        {
                            Version: migrationAction.Version,
                            ExecutionUtcDate: utcNow.toISOString(),
                        };

                        migrationDataDocument.ExecutionsRegistersByVersion[currentMigrationVersion] = migrationExecutionRegister;
                    }
                })
        );

        migrationDataDocument.CurrentVersion = currentMigrationVersion;
        await DataMigrationsHandler.SetMigrationData(migrationDataDocument);

        console.log(
            '> data migrations handling finished!' + '\n' +
            'initialMigrationVersion = ', initialMigrationVersion, '\n',
            'currentMigrationVersion = ', currentMigrationVersion, '\n',
        );

        onFinishCallback();
    }
}

export interface MigrationDataDocument
{
    CurrentVersion: number,
    ExecutionsRegistersByVersion: { [key: number]: MigrationExecutionRegister },
}

export interface MigrationExecutionRegister
{
    Version: number,
    ExecutionUtcDate: string,
}

export interface MigrationsDefinition
{
    OrderedMigrationsToRun: MigrationAction[],
}

interface MigrationAction
{
    Version: number,
    ActionsList: Array<() => Promise<void>>,
} 
