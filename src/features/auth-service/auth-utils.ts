
/**
 * Numbers used to check a document or something containing numbers.
 */
export type CheckSums = [number, number];

/**
 * Generate check sums. Multiply numbers to validators and sum them to generate
 * check sums, they're used to check if numbers are valid.
 * @param numbers - Numbers used to generate checkers.
 * @param validators - Validators used to generate checkers.
 */
const generateCheckSums = (
    numbers: Array<number>,
    validators: Array<number>,
): CheckSums =>
{
    const initialCheckSums: CheckSums = [0, 0];

    return validators.reduce(([checkerA, checkerB], validator, index) => [
        (index === 0) ? 0 : (checkerA + numbers[index - 1] * validator),
        checkerB + numbers[index] * validator
    ] as CheckSums, initialCheckSums);
};


/**
 * Maps a text to a collection of it's numbers.
 * @param value - A text containing numbers.
 */
const mapToNumbers = (
    value: string,
): Array<number> => mapToNumeric(value).split('').map(Number);

/**
 * Matches every non-numeric characters.
 */
const NonNumeric = /\D/g;

/**
 * Maps to a text containing only numeric characters.
 * @param value - A text containing numbers.
 */
const mapToNumeric = (
    value: string,
): string => value.replace(NonNumeric, '');

/**
 * Get remaining of 11 or `0` if lower than 2.
 * @param value - Value used remaining.
 */
const getRemaining = (
    value: number,
): number => (value % 11) < 2 ? 0 : 11 - (value % 11);


/**
 * Pattern to match formatted CPF (999.999.999-99) or 11 numbers.
 */
const CPF_PATTERN = /^(\d{11}|\d{3}\.\d{3}\.\d{3}\-\d{2})$/;

/**
 * Check if value is a valid CPF.
 * @example ```js
 * isCPF('366.418.768-70')
 * //=> true
 *
 * isCPF('36641876870')
 * //=> true
 *
 * isCPF('213.198.013-20')
 * //=> false
 *
 * isCPF('2131201872781')
 * //=> false
 *
 * isCPF('11111111111')
 * //=> false
 * ```
 * @param value - A text containing a CPF.
 */
export const isCPF = (
    value: string,
): boolean =>
{
    if (!CPF_PATTERN.test(value))
        return false;
    const numbers = mapToNumbers(value);
    if (isRepeatedArray(numbers))
        return false;
    const validators = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    const checkers = generateCheckSums(numbers, validators);
    return (
        numbers[9] === getRemaining(checkers[0]) &&
        numbers[10] === getRemaining(checkers[1])
    );
};

/**
 * Check if items are same, if their values are repeated.
 * @param item
 */
const isRepeatedArray = <T>(
    items: Array<T>,
): boolean => items.every((item) => items[0] === item);

/**
 * Formats step-by-step a `string` value into a CPF.
 * @example ```js
 * formatToCPF('00000000')
 * //=> '000.000.00'
 *
 * formatToCPF('00000000000')
 * //=> '000.000.000-00'
 *
 * formatToCPF('366.418.768-70')
 * //=> '366.418.768-70'
 * ```
 * @param value - A `string` value of a CPF.
 */
const formatToCPF = (
    value: string,
): string => (
    mapToNumeric(value)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
);
