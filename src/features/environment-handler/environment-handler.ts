export const ProductionEnvironmentName = 'prod';
export const DevelopmentEnvironmentName = 'dev';
export const LocalEnvironmentName = 'local';

export class EnvironmentHandler
{
    static GetEnviromentCollectionPrefix = () =>
    {
        let value = '';

        value += process.env.ENVIRONMENT_NAME + '-';

        return value;
    }

    static IsProd = () =>
    {
        let value = false;

        value = process.env.ENVIRONMENT_NAME == ProductionEnvironmentName

        return value;
    }

    static IsLocal = () =>
    {
        let value = false;

        value = process.env.ENVIRONMENT_NAME == LocalEnvironmentName

        return value;
    }

    static DoIfIsProd = (callback: () => void) =>
    {
        if (EnvironmentHandler.IsProd())
            callback();
    }

    static DoIfIsLocal = (callback: () => void) =>
    {
        if (EnvironmentHandler.IsLocal())
            callback();
    }
}
