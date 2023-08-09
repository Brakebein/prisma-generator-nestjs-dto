import { DMMF } from '@prisma/generator-helper';
import { IClassValidator, ParsedField, isApiResp } from './types';
import { isAnnotatedWith, isRelation, isType } from './field-classifiers';
import { CUSTOM_VALIDATOR } from './annotations';

const validatorsWithoutParams = [
  'IsEmpty',
  'IsDate',
  'IsBoolean',
  'IsString',
  'IsInt',
  'IsPositive',
  'IsNegative',
  'IsBooleanString',
  'IsDateString',
  'IsAlpha',
  'IsAlphaNumeric',
  'IsAscii',
  'IsBase32',
  'IsBase64',
  'IsIBAN',
  'IsBIC',
  'IsCreditCard',
  'IsEthereumAddress',
  'IsBtcAddress',
  'IsDataURI',
  'IsFullWidth',
  'IsIsHalfWidth',
  'IsIsVariableWidth',
  'IsIsHexColor',
  'IsHSLColor',
  'IsHexadecimal',
  'IsOctal',
  'IsPort',
  'IsEAN',
  'IsISIN',
  'IsJWT',
  'IsObject',
  'IsNotEmptyObject',
  'IsLowercase',
  'IsUppercase',
  'IsLatLong',
  'IsLatitude',
  'IsLongitude',
  'IsISO31661Alpha2',
  'IsISO31661Alpha3',
  'IsLocale',
  'IsMongoId',
  'IsMultiByte',
  'IsNumberString',
  'IsSurrogatePair',
  'IsMagnetURI',
  'IsFirebasePushId',
  'IsMilitaryTime',
  'IsMimeType',
  'IsSemVer',
  'IsISRC',
  'IsRFC3339',
  'Allow',
];

const validatorsWithParams = new Map<string, string>([
  ['IsDefined', "''"],
  ['Equals', "''"],
  ['NotEquals', "''"],
  ['IsIn', '[]'],
  ['IsNotIn', '[]'],
  ['IsNumber', '{}'],
  ['IsEnum', '{}'],
  ['IsDivisibleBy', '1'],
  ['Min', '0'],
  ['Max', '10'],
  ['MinDate', 'new Date()'],
  ['MaxDate', 'new Date()'],
  ['IsNumberString', '{}'],
  ['Contains', "''"],
  ['NotContains', "''"],
  ['IsDecimal', '{}'],
  ['IsByteLength', '1, 4'],
  ['IsCurrency', '{}'],
  ['IsEmail', '{}'],
  ['IsFQDN', '{}'],
  ['IsRgbColor', '{}'],
  ['IsIdentityCard', "''"],
  ['IsPassportNumber', "''"],
  ['IsPostalCode', "''"],
  ['IsMACAddress', '{}'],
  ['IsIP', "'4'"],
  ['IsISBN', "'10'"],
  ['IsISO8601', '{}'],
  ['IsMobilePhone', "''"],
  ['IsPhoneNumber', "''"],
  ['IsUrl', '{}'],
  ['IsUUID', "'4'"],
  ['Length', '0, 10'],
  ['MinLength', '0'],
  ['MaxLength', '10'],
  ['Matches', ''],
  ['IsHash', "'md4'"],
  ['IsISSN', '{}'],
  ['IsInstance', "''"],
]);

const arrayValidators = [
  'ArrayContains',
  'ArrayNotContains',
  'ArrayNotEmpty',
  'ArrayMinSize',
  'ArrayMaxSize',
  'ArrayUnique',
];

const allValidators = [
  ...validatorsWithoutParams,
  ...validatorsWithParams.keys(),
  ...arrayValidators,
];

const PrismaScalarToValidator: Record<string, IClassValidator> = {
  String: { name: 'IsString' },
  Boolean: { name: 'IsBoolean' },
  Int: { name: 'IsInt' },
  BigInt: { name: 'IsInt' },
  Float: { name: 'IsNumber' },
  Decimal: { name: 'IsDecimal' },
  DateTime: { name: 'IsDateString' },
  // Json: { name: 'IsJSON' },
};

function scalarToValidator(scalar: string): IClassValidator | undefined {
  const validator = PrismaScalarToValidator[scalar];
  if (validator) {
    return { ...PrismaScalarToValidator[scalar] };
  }
}

function extractValidator(
  field: DMMF.Field,
  prop: string,
): IClassValidator | null {
  // nested parentheses
  const regexp = new RegExp(
    `@${prop}(?:\\(([^()]*|(?:[^()]*|\\((?:[^()]*|\\((?:[^()]*|\\((?:[^()]*|\\((?:[^()]*|\\((?:[^()]*|\\([^()]*\\))*\\))*\\))*\\))*\\))*\\))*)\\))?\s*$`,
    'm',
  );
  const matches = regexp.exec(field.documentation || '');

  if (matches) {
    return {
      name: prop,
      value: matches[1],
    };
  }

  return null;
}

function optEach(validator: IClassValidator, isList: boolean): void {
  if (isList && !arrayValidators.includes(validator.name)) {
    const defaultParams = validatorsWithParams.get(validator.name);

    if (!validator.value) {
      validator.value = `${
        defaultParams ? defaultParams + ', ' : ''
      }{ each: true }`;
      return;
    }

    if (/each:/.test(validator.value)) return;

    if (defaultParams) {
      const defaults = defaultParams.split(/,\s*/);
      const values = validator.value.replace(/{.*}/, '_').split(/,\s*/);
      if (values.length > defaults.length && /.*}\s*$/.test(validator.value)) {
        validator.value = validator.value.replace(/}\s*$/, ', each: true }');
        return;
      }
      validator.value +=
        defaults.slice(values.length).join(', ') + ', { each: true }';
      return;
    }

    if (/.*}\s*$/.test(validator.value)) {
      validator.value = validator.value.replace(/}\s*$/, ', each: true }');
      return;
    }

    validator.value += ', { each: true }';
  }
}

function decorateCustomValidator(field: ParsedField): string {
  const customValidator = isAnnotatedWith(field, CUSTOM_VALIDATOR, {
    returnAnnotationParameters: true,
  });
  if (customValidator) {
    const cvs = customValidator.split(',').map((s) => s.trim());
    if (cvs.length) {
      return `@${cvs[0]}(${cvs.slice(1, cvs.length - 1).join(', ')})\n`;
    }
  }
  return '';
}

/**
 * Parse all types of class validators.
 */
export function parseClassValidators(
  field: DMMF.Field,
  dtoName?: string | ((name: string) => string),
): IClassValidator[] {
  const validators: IClassValidator[] = [];

  if (field.isRequired) {
    validators.push({ name: 'IsNotEmpty' });
  } else {
    validators.push({ name: 'IsOptional' });
  }

  if (field.isList) {
    validators.push({ name: 'IsArray' });
  }

  if (isType(field) || isRelation(field)) {
    const nestedValidator: IClassValidator = { name: 'ValidateNested' };
    optEach(nestedValidator, field.isList);
    validators.push(nestedValidator);
    validators.push({
      name: 'Type',
      value: `() => ${
        dtoName
          ? typeof dtoName === 'string'
            ? dtoName
            : dtoName(field.type)
          : field.type
      }`,
    });
  } else {
    const typeValidator = scalarToValidator(field.type);
    if (typeValidator) {
      optEach(typeValidator, field.isList);
      validators.push(typeValidator);
    }
  }

  if (field.documentation) {
    for (const prop of allValidators) {
      const validator = extractValidator(field, prop);
      if (validator) {
        // remove any auto-generated validator in favor of user-defined validator
        const index = validators.findIndex((v) => v.name === validator.name);
        if (index > -1) validators.splice(index, 1);

        optEach(validator, field.isList);
        validators.push(validator);
      }
    }
  }

  return validators;
}

/**
 * Compose `class-validator` decorators.
 */
export function decorateClassValidators(
  field: ParsedField,
  dtoType: string,
): string {
  if (!field.classValidators?.length || isApiResp(field, dtoType)) return '';

  let output = '';

  field.classValidators.forEach((prop) => {
    output += `@${prop.name}(${prop.value ? prop.value : ''})\n`;
  });
  output += decorateCustomValidator(field);

  return output;
}
