import path from 'node:path';
import slash from 'slash';
import {
  isAnnotatedWith,
  isId,
  isRelation,
  isUnique,
} from './field-classifiers';
import { scalarToTS } from './template-helpers';

import type { DMMF } from '@prisma/generator-helper';
import type { TemplateHelpers } from './template-helpers';
import type {
  IApiProperty,
  IClassValidator,
  ImportStatementParams,
  Model,
  ParsedField,
} from './types';
import { parseApiProperty } from './api-decorator';
import { parseClassValidators } from './class-validator';
import { DTO_CAST_TYPE } from './annotations';

export const uniq = <T = any>(input: T[]): T[] => Array.from(new Set(input));
export const concatIntoArray = <T = any>(source: T[], target: T[]) =>
  source.forEach((item) => target.push(item));

export function concatUniqueIntoArray<T = any>(source: T[], target: T[]): void;
export function concatUniqueIntoArray<T = { [key: string]: any }>(
  source: T[],
  target: T[],
  prop: string,
): void;
export function concatUniqueIntoArray<T = any>(
  source: T[],
  target: T[],
  prop?: string,
): void {
  const find = prop
    ? (item: T) => !target.find((v) => (v as any)[prop] === (item as any)[prop])
    : (item: T) => target.indexOf(item) < 0;
  source.filter(find).forEach((item) => target.push(item));
}

export const makeImportsFromPrismaClient = (
  fields: ParsedField[],
  prismaClientImportPath: string,
): ImportStatementParams[] => {
  const enumsToImport = uniq(
    fields.filter(({ kind }) => kind === 'enum').map(({ type }) => type),
  );
  const importPrisma = fields
    .filter(({ kind }) => kind === 'scalar')
    .some(
      ({ type, documentation }) =>
        !isAnnotatedWith({ documentation }, DTO_CAST_TYPE) &&
        scalarToTS(type).includes('Prisma'),
    );

  const prismaImport =
    enumsToImport.length || importPrisma
      ? [
          {
            from: prismaClientImportPath,
            destruct: importPrisma
              ? ['Prisma', ...enumsToImport]
              : enumsToImport,
          },
        ]
      : [];

  // Walk the fields for any that have a DTOCastType annotation that
  // requires a custom import to be appended.
  const customImports = fields.flatMap(({ documentation }) => {
    const castType = isAnnotatedWith({ documentation }, DTO_CAST_TYPE, {
      returnAnnotationParameters: true,
    });
    if (!castType || !castType.includes(',')) {
      return [];
    }

    const [importAs, importFrom, importWas] = castType
      .split(',')
      .map((s) => s.trim());

    if (!importFrom) {
      throw new Error(
        "Invalid DTOCastType annotation. Requesting import but did not provide 'from' value.",
      );
    }

    if (!importWas || importWas === importAs) {
      return {
        from: importFrom,
        destruct: [importAs],
      };
    } else if (importWas === 'default') {
      return {
        from: importFrom,
        default: importAs,
      };
    } else if (importWas === '*') {
      return {
        from: importFrom,
        default: { '*': importAs },
      };
    } else {
      return {
        from: importFrom,
        destruct: [{ [importWas]: importAs }],
      };
    }
  });

  return [...prismaImport, ...customImports];
};

export const mapDMMFToParsedField = (
  field: DMMF.Field,
  overrides: Partial<DMMF.Field> = {},
  decorators: {
    apiProperties?: IApiProperty[];
    classValidators?: IClassValidator[];
  } = {},
): ParsedField => ({
  ...field,
  ...overrides,
  ...decorators,
});

export const getRelationScalars = (
  fields: DMMF.Field[],
): Record<string, string[]> => {
  const scalars = fields.flatMap(
    ({ relationFromFields = [] }) => relationFromFields,
  );

  return scalars.reduce(
    (result, scalar) => ({
      ...result,
      [scalar]: fields
        .filter(({ relationFromFields = [] }) =>
          relationFromFields.includes(scalar),
        )
        .map(({ name }) => name),
    }),
    {} as Record<string, string[]>,
  );
};

interface GetRelationConnectInputFieldsParam {
  field: DMMF.Field;
  allModels: DMMF.Model[];
}
export const getRelationConnectInputFields = ({
  field,
  allModels,
}: GetRelationConnectInputFieldsParam): Set<DMMF.Field> => {
  const { name, type, relationToFields = [] } = field;

  if (!isRelation(field)) {
    throw new Error(
      `Can not resolve RelationConnectInputFields for field '${name}'. Not a relation field.`,
    );
  }

  const relatedModel = allModels.find(
    ({ name: modelName }) => modelName === type,
  );

  if (!relatedModel) {
    throw new Error(
      `Can not resolve RelationConnectInputFields for field '${name}'. Related model '${type}' unknown.`,
    );
  }

  if (!relationToFields.length) {
    throw new Error(
      `Can not resolve RelationConnectInputFields for field '${name}'. Foreign keys are unknown.`,
    );
  }

  const foreignKeyFields = relationToFields.map((relationToFieldName) => {
    const relatedField = relatedModel.fields.find(
      (relatedModelField) => relatedModelField.name === relationToFieldName,
    );

    if (!relatedField)
      throw new Error(
        `Can not find foreign key field '${relationToFieldName}' on model '${relatedModel.name}'`,
      );

    return relatedField;
  });

  const idFields = relatedModel.fields.filter((relatedModelField) =>
    isId(relatedModelField),
  );

  const uniqueFields = relatedModel.fields.filter((relatedModelField) =>
    isUnique(relatedModelField),
  );

  const foreignFields = new Set<DMMF.Field>([
    ...foreignKeyFields,
    ...idFields,
    ...uniqueFields,
  ]);

  return foreignFields;
};

export const getRelativePath = (from: string, to: string) => {
  const result = slash(path.relative(from, to));
  return result || '.';
};

interface GenerateRelationInputParam {
  field: DMMF.Field;
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
  preAndSuffixClassName:
    | TemplateHelpers['createDtoName']
    | TemplateHelpers['updateDtoName'];
  canCreateAnnotation: RegExp;
  canConnectAnnotation: RegExp;
}
export const generateRelationInput = ({
  field,
  model,
  allModels,
  templateHelpers: t,
  preAndSuffixClassName,
  canCreateAnnotation,
  canConnectAnnotation,
}: GenerateRelationInputParam) => {
  const relationInputClassProps: Array<
    Pick<ParsedField, 'name' | 'type' | 'apiProperties' | 'classValidators'>
  > = [];

  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const generatedClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const createRelation = isAnnotatedWith(field, canCreateAnnotation);
  const connectRelation = isAnnotatedWith(field, canConnectAnnotation);
  const isRequired = !(createRelation && connectRelation);

  if (createRelation) {
    const preAndPostfixedName = t.createDtoName(field.type);
    apiExtraModels.push(preAndPostfixedName);

    const modelToImportFrom = allModels.find(({ name }) => name === field.type);

    if (!modelToImportFrom)
      throw new Error(
        `related model '${field.type}' for '${model.name}.${field.name}' not found`,
      );

    imports.push({
      from: slash(
        `${getRelativePath(model.output.dto, modelToImportFrom.output.dto)}${
          path.sep
        }${t.createDtoFilename(field.type)}`,
      ),
      destruct: [preAndPostfixedName],
    });

    const decorators: {
      apiProperties?: IApiProperty[];
      classValidators?: IClassValidator[];
    } = {};

    if (t.config.classValidation) {
      decorators.classValidators = parseClassValidators(
        { ...field, isRequired },
        preAndPostfixedName,
      );
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!t.config.noDependencies) {
      decorators.apiProperties = parseApiProperty({ ...field, isRequired });
      decorators.apiProperties.push({
        name: 'type',
        value: preAndPostfixedName,
        noEncapsulation: true,
      });
    }

    relationInputClassProps.push({
      name: 'create',
      type: preAndPostfixedName,
      apiProperties: decorators.apiProperties,
      classValidators: decorators.classValidators,
    });
  }

  if (connectRelation) {
    const preAndPostfixedName = t.connectDtoName(field.type);
    apiExtraModels.push(preAndPostfixedName);
    const modelToImportFrom = allModels.find(({ name }) => name === field.type);

    if (!modelToImportFrom)
      throw new Error(
        `related model '${field.type}' for '${model.name}.${field.name}' not found`,
      );

    imports.push({
      from: slash(
        `${getRelativePath(model.output.dto, modelToImportFrom.output.dto)}${
          path.sep
        }${t.connectDtoFilename(field.type)}`,
      ),
      destruct: [preAndPostfixedName],
    });

    const decorators: {
      apiProperties?: IApiProperty[];
      classValidators?: IClassValidator[];
    } = {};

    if (t.config.classValidation) {
      decorators.classValidators = parseClassValidators(
        { ...field, isRequired },
        preAndPostfixedName,
      );
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!t.config.noDependencies) {
      decorators.apiProperties = parseApiProperty({ ...field, isRequired });
      decorators.apiProperties.push({
        name: 'type',
        value: preAndPostfixedName,
        noEncapsulation: true,
      });
    }

    relationInputClassProps.push({
      name: 'connect',
      type: preAndPostfixedName,
      apiProperties: decorators.apiProperties,
      classValidators: decorators.classValidators,
    });
  }

  if (!relationInputClassProps.length) {
    throw new Error(
      `Can not find relation input props for '${model.name}.${field.name}'`,
    );
  }

  const originalInputClassName = `${t.transformClassNameCase(
    model.name,
  )}${t.transformClassNameCase(field.name)}RelationInput`;

  const preAndPostfixedInputClassName = preAndSuffixClassName(
    originalInputClassName,
  );
  generatedClasses.push(`${
    t.config.outputType
  } ${preAndPostfixedInputClassName} {
    ${t.fieldsToDtoProps(
      relationInputClassProps.map((inputField) => ({
        ...inputField,
        kind: 'relation-input',
        isRequired: relationInputClassProps.length === 1,
        isList: field.isList,
      })),
      'plain',
      true,
    )}
  }`);

  apiExtraModels.push(preAndPostfixedInputClassName);

  return {
    type: preAndPostfixedInputClassName,
    imports,
    generatedClasses,
    apiExtraModels,
    classValidators,
  };
};

export const mergeImportStatements = (
  first: ImportStatementParams,
  second: ImportStatementParams,
): ImportStatementParams => {
  if (first.from !== second.from) {
    throw new Error(
      `Can not merge import statements; 'from' parameter is different`,
    );
  }

  if (first.default && second.default && first.default !== second.default) {
    throw new Error(
      `Can not merge import statements; both statements have set the 'default' preoperty`,
    );
  }

  const firstDestruct = first.destruct || [];
  const secondDestruct = second.destruct || [];
  const destructStrings = uniq(
    [...firstDestruct, ...secondDestruct].filter(
      (destructItem) => typeof destructItem === 'string',
    ),
  );

  const destructObject = [...firstDestruct, ...secondDestruct].reduce(
    (result: Record<string, string>, destructItem) => {
      if (typeof destructItem === 'string') return result;

      return { ...result, ...destructItem };
    },
    {} as Record<string, string>,
  );

  return {
    ...first,
    ...second,
    destruct: [...destructStrings, destructObject],
  };
};

export const zipImportStatementParams = (
  items: ImportStatementParams[],
): ImportStatementParams[] => {
  const itemsByFrom = items.reduce((result, item) => {
    const { from } = item;
    const { [from]: existingItem } = result;
    if (!existingItem) {
      return { ...result, [from]: item };
    }
    return { ...result, [from]: mergeImportStatements(existingItem, item) };
  }, {} as Record<ImportStatementParams['from'], ImportStatementParams>);

  return Object.values(itemsByFrom);
};
