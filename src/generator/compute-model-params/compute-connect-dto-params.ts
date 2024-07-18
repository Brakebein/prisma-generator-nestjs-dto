import type { DMMF } from '@prisma/generator-helper';
import { isAnnotatedWith, isId, isUnique } from '../field-classifiers';
import {
  concatIntoArray,
  concatUniqueIntoArray,
  generateUniqueInput,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  uniq,
  zipImportStatementParams,
} from '../helpers';
import type {
  ConnectDtoParams,
  IClassValidator,
  IDecorators,
  ImportStatementParams,
  Model,
} from '../types';
import { parseClassValidators } from '../class-validator';
import { TemplateHelpers } from '../template-helpers';
import {
  makeImportsFromNestjsSwagger,
  parseApiProperty,
} from '../api-decorator';
import { DTO_CONNECT_HIDDEN } from '../annotations';

interface ComputeConnectDtoParamsParam {
  model: Model;
  templateHelpers: TemplateHelpers;
}
export const computeConnectDtoParams = ({
  model,
  templateHelpers,
}: ComputeConnectDtoParamsParam): ConnectDtoParams => {
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const extraClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const idFields = model.fields.filter(
    (field) => !isAnnotatedWith(field, DTO_CONNECT_HIDDEN) && isId(field),
  );
  const isUniqueFields = model.fields.filter(
    (field) => !isAnnotatedWith(field, DTO_CONNECT_HIDDEN) && isUnique(field),
  );

  const uniqueCompoundFields: {
    name: string | null;
    fields: string[];
  }[] = model.uniqueIndexes;
  if (model.primaryKey) uniqueCompoundFields.unshift(model.primaryKey);
  const uniqueCompounds: { name: string; fields: DMMF.Field[] }[] = [];

  uniqueCompoundFields.forEach((uniqueIndex) => {
    const fields: DMMF.Field[] = [];
    uniqueIndex.fields.forEach((fieldName) => {
      const field = model.fields.find((f) => f.name === fieldName);
      if (field) fields.push(field);
    });
    uniqueCompounds.push({
      name: uniqueIndex.name || fields.map((field) => field.name).join('_'),
      fields,
    });
  });

  /**
   * @ApiProperty({
   *  type: 'array',
   *  items: {
   *    oneOf: [{ $ref: getSchemaPath(A) }, { $ref: getSchemaPath(B) }],
   *  },
   * })
   * connect?: (A | B)[];
   */
  // TODO consider adding documentation block to model that one of the properties must be provided
  const uniqueFields = uniq([...idFields, ...isUniqueFields]);
  const overrides =
    uniqueFields.length + uniqueCompounds.length > 1
      ? { isRequired: false }
      : {};

  uniqueCompounds.forEach((compound) => {
    const compoundInput = generateUniqueInput({
      compoundName: compound.name,
      fields: compound.fields,
      model,
      templateHelpers,
    });
    concatIntoArray(compoundInput.imports, imports);
    concatIntoArray(compoundInput.generatedClasses, extraClasses);
    if (!templateHelpers.config.noDependencies)
      concatIntoArray(compoundInput.apiExtraModels, apiExtraModels);
    concatUniqueIntoArray(
      compoundInput.classValidators,
      classValidators,
      'name',
    );

    uniqueFields.push({
      name: compound.name,
      type: compoundInput.type,
      kind: 'object',
      isList: false,
      isRequired: true,
      isId: false,
      isUnique: false,
      isReadOnly: true,
      hasDefaultValue: false,
      pureType: true,
    });
  });

  const fields = uniqueFields.map((field) => {
    const decorators: IDecorators = {};

    if (templateHelpers.config.classValidation) {
      decorators.classValidators = parseClassValidators({
        ...field,
        ...overrides,
      });
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!templateHelpers.config.noDependencies) {
      decorators.apiProperties = parseApiProperty(
        {
          ...field,
          ...overrides,
        },
        {
          default: false,
          type: templateHelpers.config.outputApiPropertyType,
        },
      );
      const typeProperty = decorators.apiProperties.find(
        (p) => p.name === 'type',
      );
      if (typeProperty?.value === field.type && field.type === 'Json')
        typeProperty.value = '() => Object';
    }

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'Float';
    }

    return mapDMMFToParsedField(field, overrides, decorators);
  });

  if (classValidators.length) {
    if (classValidators.find((cv) => cv.name === 'Type')) {
      imports.unshift({
        from: 'class-transformer',
        destruct: ['Type'],
      });
    }
    imports.unshift({
      from: 'class-validator',
      destruct: classValidators
        .filter((cv) => cv.name !== 'Type')
        .map((v) => v.name)
        .sort(),
    });
  }

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers.config.prismaClientImportPath,
  );

  const importNestjsSwagger = makeImportsFromNestjsSwagger(
    fields,
    apiExtraModels,
  );

  return {
    model,
    fields,
    imports: zipImportStatementParams([
      ...importPrismaClient,
      ...importNestjsSwagger,
      ...imports,
    ]),
    extraClasses,
    apiExtraModels,
  };
};
