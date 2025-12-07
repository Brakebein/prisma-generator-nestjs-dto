import { DMMF } from '@prisma/generator-helper';
import { DTO_CAST_TYPE, DTO_TYPE_FULL_UPDATE } from './annotations';
import { decorateApiProperty } from './api-decorator';
import { decorateClassValidators } from './class-validator';
import { isAnnotatedWith, isScalar, isType } from './field-classifiers';
import { ImportStatementParams, ParsedField, isApiResp } from './types';

const PrismaScalarToTypeScript: Record<string, string> = {
  String: 'string',
  Boolean: 'boolean',
  Int: 'number',
  // [Working with BigInt](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields#working-with-bigint)
  BigInt: 'bigint',
  Float: 'number',
  // [Working with Decimal](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields#working-with-decimal)
  Decimal: 'Prisma.Decimal',
  DateTime: 'Date',
  // [working with JSON fields](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields)
  Json: 'Prisma.JsonValue',
  // [Working with Bytes](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields#working-with-bytes)
  Bytes: 'Buffer',
  Object: '{ [key: string]: any }',
};

const knownPrismaScalarTypes = Object.keys(PrismaScalarToTypeScript);

export const scalarToTS = (scalar: string, useInputTypes = false): string => {
  if (!knownPrismaScalarTypes.includes(scalar)) {
    throw new Error(`Unrecognized scalar type: ${scalar}`);
  }

  // [Working with JSON fields](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields)
  // supports different types for input / output. `Prisma.InputJsonValue` extends `Prisma.JsonValue` with `undefined`
  if (useInputTypes && scalar === 'Json') {
    return 'Prisma.InputJsonValue';
  }

  return PrismaScalarToTypeScript[scalar];
};

export const echo = (input: string) => input;

export const when = (condition: any, thenTemplate: string, elseTemplate = '') =>
  condition ? thenTemplate : elseTemplate;

export const unless = (
  condition: any,
  thenTemplate: string,
  elseTemplate = '',
) => (!condition ? thenTemplate : elseTemplate);

export const each = <T = any>(
  arr: Array<T>,
  fn: (item: T) => string,
  joinWith = '',
) => arr.map(fn).join(joinWith);

export const importStatement = (input: ImportStatementParams) => {
  const { from, destruct = [], default: defaultExport } = input;
  const fragments = ['import'];
  if (defaultExport) {
    if (typeof defaultExport === 'string') {
      fragments.push(defaultExport);
    } else {
      fragments.push(`* as ${defaultExport['*']}`);
    }
  }
  if (destruct.length) {
    if (defaultExport) {
      fragments.push(',');
    }
    fragments.push(
      `{${destruct.flatMap((item) => {
        if (typeof item === 'string') return item;
        return Object.entries(item).map(([key, value]) => `${key} as ${value}`);
      })}}`,
    );
  }

  fragments.push(`from '${from}'`);

  return fragments.join(' ');
};

export const importStatements = (items: ImportStatementParams[]) =>
  `${each(items, importStatement, '\n')}`;

interface MakeHelpersParam {
  connectDtoPrefix: string;
  createDtoPrefix: string;
  updateDtoPrefix: string;
  dtoSuffix: string;
  entityPrefix: string;
  entitySuffix: string;
  transformClassNameCase?: (item: string) => string;
  transformFileNameCase?: (item: string) => string;
  classValidation: boolean;
  outputType: string;
  noDependencies: boolean;
  definiteAssignmentAssertion: boolean;
  prismaClientImportPath: string;
}
export const makeHelpers = ({
  connectDtoPrefix,
  createDtoPrefix,
  updateDtoPrefix,
  dtoSuffix,
  entityPrefix,
  entitySuffix,
  transformClassNameCase = echo,
  transformFileNameCase = echo,
  classValidation,
  outputType,
  noDependencies,
  definiteAssignmentAssertion,
  prismaClientImportPath,
}: MakeHelpersParam) => {
  const className = (name: string, prefix = '', suffix = '') =>
    `${prefix}${transformClassNameCase(name)}${suffix}`;
  const fileName = (
    name: string,
    prefix = '',
    suffix = '',
    withExtension = false,
  ) =>
    `${prefix}${transformFileNameCase(name)}${suffix}${when(
      withExtension,
      '.ts',
    )}`;

  const entityName = (name: string) =>
    new RegExp(`${dtoSuffix || 'dto'}$`, 'i').test(name)
      ? className(name, '', '')
      : className(name, entityPrefix, entitySuffix);
  const connectDtoName = (name: string) =>
    className(name, connectDtoPrefix, dtoSuffix);
  const createDtoName = (name: string) =>
    className(name, createDtoPrefix, dtoSuffix);
  const updateDtoName = (name: string) =>
    className(name, updateDtoPrefix, dtoSuffix);
  const plainDtoName = (name: string) => className(name, '', dtoSuffix);
  const dtoName = (name: string, dtoType: 'create' | 'update' | 'plain') => {
    switch (dtoType) {
      case 'create':
        return createDtoName(name);
      case 'update':
        return updateDtoName(name);
      default:
        return plainDtoName(name);
    }
  };

  const connectDtoFilename = (name: string, withExtension = false) =>
    fileName(name, 'connect-', '.dto', withExtension);

  const createDtoFilename = (name: string, withExtension = false) =>
    fileName(name, 'create-', '.dto', withExtension);

  const updateDtoFilename = (name: string, withExtension = false) =>
    fileName(name, 'update-', '.dto', withExtension);

  const entityFilename = (name: string, withExtension = false) =>
    fileName(name, undefined, '.entity', withExtension);

  const plainDtoFilename = (name: string, withExtension = false) =>
    fileName(name, undefined, '.dto', withExtension);

  const getRawCastType = (field: ParsedField) => {
    const rawCastType =
      (isType(field as DMMF.Field) || isScalar(field as DMMF.Field)) &&
      isAnnotatedWith(field as DMMF.Field, DTO_CAST_TYPE, {
        returnAnnotationParameters: true,
      });

    const castType = rawCastType ? rawCastType.split(',')[0] : undefined;
    return castType;
  };

  const fieldType = (
    field: ParsedField,
    castType: string | undefined,
    dtoType: 'create' | 'update' | 'plain' = 'plain',
    toInputType = false,
  ) => {
    const doFullUpdate =
      dtoType === 'update' &&
      isType(field as DMMF.Field) &&
      isAnnotatedWith(field as DMMF.Field, DTO_TYPE_FULL_UPDATE);

    if (field.documentation?.includes('%') && dtoType === 'create') {
      const type = field.documentation
        .split('\n')
        .filter((item) => item.includes('%'))[0]
        .replace(/%/g, '');

      if (type) {
        return field.isList ? `${type}[]` : type;
      }
    }

    return `${
      castType ||
      (field.kind === 'scalar'
        ? scalarToTS(field.type, toInputType)
        : field.kind === 'enum' ||
          field.kind === 'relation-input' ||
          field.pureType === true
        ? field.type
        : field.relationName
        ? entityName(field.type)
        : dtoName(field.type, doFullUpdate ? 'create' : dtoType))
    }${when(field.isList, '[]')}`;
  };

  const fieldToDtoProp = (
    field: ParsedField,
    dtoType: 'create' | 'update' | 'plain',
    useInputTypes = false,
    forceOptional = false,
  ) => {
    const castType = getRawCastType(field);
    forceOptional || (forceOptional = isApiResp(field, dtoType));
    return `${decorateApiProperty(
      field,
      castType,
      dtoType,
    )}${decorateClassValidators(field, dtoType)}${field.name}${unless(
      field.isRequired && !forceOptional,
      '?',
      when(definiteAssignmentAssertion, '!'),
    )}: ${fieldType(field, castType, dtoType, useInputTypes)} ${when(
      field.isNullable,
      ' | null',
    )};\n`;
  };

  const fieldsToDtoProps = (
    fields: ParsedField[],
    dtoType: 'create' | 'update' | 'plain',
    useInputTypes = false,
    forceOptional = false,
  ) =>
    `${each(
      fields,
      (field) => fieldToDtoProp(field, dtoType, useInputTypes, forceOptional),
      '\n',
    )}`;

  const fieldToEntityProp = (field: ParsedField) => {
    const castType = getRawCastType(field);
    return `${decorateApiProperty(field, castType)}@Expose()\n${
      field.name
    }${unless(
      field.isRequired,
      '?',
      when(definiteAssignmentAssertion, '!'),
    )}: ${fieldType(field, castType)} ${when(
      field.apiProperties
        ? field.apiProperties.find((property) => property.name === 'nullable')
            ?.value === 'true'
        : field.isNullable,
      ' | null',
    )};\n`;
  };

  const fieldsToEntityProps = (fields: ParsedField[]) =>
    `${each(fields, (field) => fieldToEntityProp(field), '\n')}`;

  const apiExtraModels = (names: string[]) =>
    `@ApiExtraModels(${names.map(entityName)})`;

  return {
    config: {
      connectDtoPrefix,
      createDtoPrefix,
      updateDtoPrefix,
      dtoSuffix,
      entityPrefix,
      entitySuffix,
      classValidation,
      outputType,
      noDependencies,
      definiteAssignmentAssertion,
      prismaClientImportPath,
    },
    apiExtraModels,
    entityName,
    connectDtoName,
    createDtoName,
    updateDtoName,
    plainDtoName,
    connectDtoFilename,
    createDtoFilename,
    updateDtoFilename,
    entityFilename,
    plainDtoFilename,
    each,
    echo,
    fieldsToDtoProps,
    fieldToDtoProp,
    fieldToEntityProp,
    fieldsToEntityProps,
    fieldType,
    for: each,
    if: when,
    importStatement,
    importStatements,
    transformClassNameCase,
    transformFileNameCase,
    unless,
    when,
  };
};

export type TemplateHelpers = ReturnType<typeof makeHelpers>;
